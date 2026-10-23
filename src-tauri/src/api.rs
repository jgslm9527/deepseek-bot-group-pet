use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

use crate::config::AppConfigState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ApiMessage>,
    pub temperature: Option<f64>,
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub json_mode: bool,
    pub timeout_secs: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub latency_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatResult {
    pub content: String,
    pub model: String,
    pub usage: TokenUsage,
}

#[derive(Debug, Deserialize)]
struct ProviderUsage {
    #[serde(default)]
    prompt_tokens: u32,
    #[serde(default)]
    completion_tokens: u32,
    #[serde(default)]
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
struct ProviderMessage {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProviderChoice {
    message: ProviderMessage,
    #[allow(dead_code)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProviderResponse {
    #[serde(default)]
    model: String,
    choices: Vec<ProviderChoice>,
    usage: Option<ProviderUsage>,
}

fn provider_error(status: u16, raw: &str) -> String {
    let message = serde_json::from_str::<serde_json::Value>(raw)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.get("message"))
                .and_then(|message| message.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| {
            let compact = raw.split_whitespace().collect::<Vec<_>>().join(" ");
            compact.chars().take(360).collect()
        });

    match status {
        401 => format!("API Key 无效或已过期（401）。{message}"),
        402 => format!("账户额度不足（402）。{message}"),
        429 => format!("请求过于频繁或额度受限（429）。{message}"),
        _ => format!("DeepSeek API 错误（{status}）：{message}"),
    }
}

async fn perform_chat(
    client: &reqwest::Client,
    config: &crate::config::AppConfig,
    request: ChatRequest,
) -> Result<ChatResult, String> {
    if config.api_key.trim().is_empty() {
        return Err("尚未配置 DeepSeek API Key，请先在设置中填写。".into());
    }
    if request.messages.is_empty() {
        return Err("消息列表不能为空。".into());
    }
    if request.model.trim().is_empty() {
        return Err("模型名称不能为空。".into());
    }

    let total_chars: usize = request.messages.iter().map(|m| m.content.chars().count()).sum();
    if total_chars > 600_000 {
        return Err("单次请求上下文过长，已阻止本次调用。请清空部分历史或降低上下文条数。".into());
    }

    let timeout_secs = request.timeout_secs.unwrap_or(90).clamp(10, 300);
    let mut body = json!({
        "model": request.model,
        "messages": request.messages,
        "stream": false,
        "max_tokens": request.max_tokens.unwrap_or(4096).clamp(1, 16384),
    });

    // deepseek-reasoner ignores/forbids sampling parameters on some API versions.
    if request.model != "deepseek-reasoner" {
        if let Some(temperature) = request.temperature {
            body["temperature"] = json!(temperature.clamp(0.0, 2.0));
        }
    }
    if request.json_mode {
        body["response_format"] = json!({ "type": "json_object" });
    }

    let started = Instant::now();
    let response = client
        .post(config.endpoint())
        .bearer_auth(config.api_key.trim())
        .header("Accept", "application/json")
        .json(&body)
        .timeout(Duration::from_secs(timeout_secs))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                format!("请求超时（{timeout_secs} 秒），已停止等待。自动轮询将暂停。")
            } else if error.is_connect() {
                "无法连接 DeepSeek API，请检查网络或 Base URL。".to_string()
            } else {
                format!("网络请求失败：{error}")
            }
        })?;

    let status = response.status();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("读取 API 响应失败：{error}"))?;
    let raw = String::from_utf8_lossy(&bytes);

    if !status.is_success() {
        return Err(provider_error(status.as_u16(), &raw));
    }

    let payload: ProviderResponse =
        serde_json::from_str(&raw).map_err(|error| format!("解析 API 响应失败：{error}"))?;
    let content = payload
        .choices
        .first()
        .and_then(|choice| choice.message.content.clone())
        .unwrap_or_default();
    if content.trim().is_empty() {
        return Err("模型返回了空内容，请重试或切换模型。".into());
    }

    let usage = payload.usage.unwrap_or(ProviderUsage {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
    });
    let total_tokens = if usage.total_tokens > 0 {
        usage.total_tokens
    } else {
        usage.prompt_tokens + usage.completion_tokens
    };

    Ok(ChatResult {
        content,
        model: if payload.model.is_empty() {
            request.model
        } else {
            payload.model
        },
        usage: TokenUsage {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens,
            latency_ms: started.elapsed().as_millis() as u64,
        },
    })
}

#[tauri::command]
pub async fn deepseek_chat(
    state: State<'_, AppConfigState>,
    request: ChatRequest,
) -> Result<ChatResult, String> {
    let config = state.snapshot();
    let client = state.client.clone();
    perform_chat(&client, &config, request).await
}

#[tauri::command]
pub async fn test_deepseek(state: State<'_, AppConfigState>) -> Result<ChatResult, String> {
    let config = state.snapshot();
    let client = state.client.clone();
    let request = ChatRequest {
        model: "deepseek-chat".into(),
        messages: vec![ApiMessage {
            role: "user".into(),
            content: "只回复 pong".into(),
        }],
        temperature: Some(0.0),
        max_tokens: Some(4),
        json_mode: false,
        timeout_secs: Some(30),
    };
    perform_chat(&client, &config, request).await
}

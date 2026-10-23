<script setup lang="ts">
withDefaults(
  defineProps<{
    mode: 'idle' | 'thinking' | 'new-message' | 'error' | 'muted'
    hovered?: boolean
  }>(),
  { hovered: false },
)
</script>

<template>
  <svg
    class="pet-robot"
    :data-mode="mode"
    viewBox="0 0 120 120"
    width="120"
    height="120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="pet-shell" x1="28" y1="28" x2="94" y2="100" gradientUnits="userSpaceOnUse">
        <stop stop-color="#2459C8" />
        <stop offset="0.5" stop-color="#163B91" />
        <stop offset="1" stop-color="#081631" />
      </linearGradient>
      <linearGradient id="pet-face" x1="32" y1="34" x2="88" y2="81" gradientUnits="userSpaceOnUse">
        <stop stop-color="#0B214A" />
        <stop offset="1" stop-color="#030A1B" />
      </linearGradient>
      <linearGradient id="pet-body" x1="42" y1="88" x2="78" y2="112" gradientUnits="userSpaceOnUse">
        <stop stop-color="#1D4CA8" />
        <stop offset="1" stop-color="#0A1B43" />
      </linearGradient>
      <radialGradient id="pet-glow" cx="0" cy="0" r="1" gradientTransform="translate(60 58) rotate(90) scale(45)">
        <stop stop-color="#22D3EE" stop-opacity="0.25" />
        <stop offset="1" stop-color="#22D3EE" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="pet-eye" x1="42" y1="49" x2="78" y2="65" gradientUnits="userSpaceOnUse">
        <stop stop-color="#C9FBFF" />
        <stop offset="0.45" stop-color="#2FE5F9" />
        <stop offset="1" stop-color="#0EA5E9" />
      </linearGradient>
      <filter id="pet-eye-glow" x="24" y="30" width="72" height="58" filterUnits="userSpaceOnUse">
        <feGaussianBlur stdDeviation="3.2" />
      </filter>
      <filter id="pet-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    <!-- floor shadow -->
    <ellipse cx="60" cy="112" rx="28" ry="4.5" fill="#00122E" opacity="0.22" />

    <!-- ambient light -->
    <circle cx="60" cy="58" r="45" fill="url(#pet-glow)" />

    <!-- thinking orbit -->
    <g class="think-orbit" opacity="0">
      <circle cx="60" cy="61" r="51" stroke="#38E8FF" stroke-opacity="0.45" stroke-width="1" stroke-dasharray="4 7" />
      <circle cx="60" cy="10" r="2" fill="#61F4FF" />
    </g>

    <!-- antenna -->
    <path d="M60 13V28" stroke="#5CC8F2" stroke-width="2.6" stroke-linecap="round" />
    <circle class="antenna-halo" cx="60" cy="10" r="7" fill="#22D3EE" opacity="0.16" filter="url(#pet-soft-glow)" />
    <circle cx="60" cy="10" r="4.4" fill="#7DF3FF" />
    <circle cx="60" cy="10" r="2.1" fill="#EAFFFF" />

    <!-- ears -->
    <rect x="15" y="44" width="11" height="30" rx="5.5" fill="#1C4EA9" />
    <rect x="94" y="44" width="11" height="30" rx="5.5" fill="#1C4EA9" />
    <rect x="18" y="49" width="4.5" height="20" rx="2.2" fill="#5FDBFF" opacity="0.76" />
    <rect x="97" y="49" width="4.5" height="20" rx="2.2" fill="#5FDBFF" opacity="0.76" />

    <!-- arms -->
    <g class="pet-arms">
      <rect x="23" y="83" width="16" height="10" rx="5" fill="#153A88" transform="rotate(-18 31 88)" />
      <rect x="81" y="83" width="16" height="10" rx="5" fill="#153A88" transform="rotate(18 89 88)" />
    </g>

    <!-- body -->
    <rect x="39" y="88" width="42" height="21" rx="9" fill="url(#pet-body)" stroke="#3D7DE0" stroke-opacity="0.35" />
    <rect x="51" y="94" width="18" height="3.2" rx="1.6" fill="#2DD4EF" opacity="0.8" />
    <circle cx="49" cy="102" r="1.7" fill="#61F4FF" opacity="0.8" />
    <circle cx="71" cy="102" r="1.7" fill="#A78BFA" opacity="0.8" />

    <!-- head -->
    <rect x="21" y="26" width="78" height="64" rx="24" fill="url(#pet-shell)" stroke="#4A8AF0" stroke-opacity="0.55" stroke-width="1.2" />
    <rect x="24" y="29" width="72" height="58" rx="21" stroke="#7BC9FF" stroke-opacity="0.24" />

    <!-- face screen -->
    <rect x="29" y="35" width="62" height="46" rx="17" fill="url(#pet-face)" stroke="#2C71C8" stroke-opacity="0.5" />
    <rect x="32" y="38" width="56" height="40" rx="14" stroke="#5EDBFF" stroke-opacity="0.11" />

    <!-- eyes -->
    <g class="pet-eyes">
      <circle cx="47.5" cy="56.5" r="7.8" fill="url(#pet-eye)" filter="url(#pet-eye-glow)" opacity="0.55" />
      <circle cx="72.5" cy="56.5" r="7.8" fill="url(#pet-eye)" filter="url(#pet-eye-glow)" opacity="0.55" />
      <g class="eye">
        <ellipse cx="47.5" cy="56.5" rx="7.2" ry="8" fill="url(#pet-eye)" />
        <ellipse class="pupil" cx="47.5" cy="57.5" rx="3.4" ry="4.2" fill="#052241" />
        <circle cx="45.6" cy="53.9" r="1.45" fill="#F2FFFF" />
      </g>
      <g class="eye">
        <ellipse cx="72.5" cy="56.5" rx="7.2" ry="8" fill="url(#pet-eye)" />
        <ellipse class="pupil" cx="72.5" cy="57.5" rx="3.4" ry="4.2" fill="#052241" />
        <circle cx="70.6" cy="53.9" r="1.45" fill="#F2FFFF" />
      </g>
      <circle class="muted-eye" cx="47.5" cy="56.5" r="2.2" fill="#64748B" opacity="0" />
      <circle class="muted-eye" cx="72.5" cy="56.5" r="2.2" fill="#64748B" opacity="0" />
    </g>

    <!-- mouth -->
    <path class="pet-mouth" d="M55 70C57.5 72.4 62.5 72.4 65 70" stroke="#4BE1F4" stroke-width="1.9" stroke-linecap="round" opacity="0.8" />

    <!-- chest status light -->
    <circle class="chest-light" cx="60" cy="96" r="2.2" fill="#22D3EE" />

    <!-- error / muted overlays are CSS-driven -->
  </svg>
</template>

<style scoped>
.pet-robot {
  overflow: visible;
  filter: drop-shadow(0 10px 12px rgba(1, 10, 30, 0.28));
}
.pet-eyes {
  transform-origin: 60px 57px;
  animation: pet-blink 5.6s infinite;
}
.think-orbit {
  transform-origin: 60px 61px;
  transition: opacity 240ms ease;
  animation: pet-orbit 2.8s linear infinite;
}
.pet-robot[data-mode="thinking"] .think-orbit {
  opacity: 1;
}
.pet-robot[data-mode="thinking"] .pet-eyes {
  animation: pet-eyes-thinking 1.2s ease-in-out infinite;
}
.pet-robot[data-mode="thinking"] .pupil {
  animation: pet-pupil-scan 1.15s ease-in-out infinite;
}
.pet-robot[data-mode="thinking"] .antenna-halo {
  opacity: 0.55;
  animation: pet-halo 1s ease-in-out infinite;
}
.pet-robot[data-mode="thinking"] .chest-light {
  animation: pet-light 0.85s ease-in-out infinite;
}
.pet-robot[data-mode="thinking"] .pet-mouth {
  opacity: 0.35;
}
.pet-robot[data-mode="new-message"] .chest-light {
  animation: pet-light 0.6s ease-in-out 2;
}
.pet-robot[data-mode="error"] .eye ellipse:first-child {
  fill: #FB7185;
}
.pet-robot[data-mode="error"] .pet-mouth {
  opacity: 0.3;
}
.pet-robot[data-mode="error"] .think-orbit {
  opacity: 0;
}
.pet-robot[data-mode="muted"] .pet-eyes .eye {
  opacity: 0.18;
}
.pet-robot[data-mode="muted"] .muted-eye {
  opacity: 0.9;
}
.pet-robot[data-mode="muted"] .chest-light {
  fill: #64748B;
}

@keyframes pet-blink {
  0%, 43%, 47%, 100% { transform: scaleY(1); }
  45% { transform: scaleY(0.12); }
}
@keyframes pet-eyes-thinking {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.4); }
}
@keyframes pet-pupil-scan {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(1.7px, -0.4px); }
  50% { transform: translate(0, 1px); }
  75% { transform: translate(-1.7px, -0.4px); }
}
@keyframes pet-orbit {
  to { transform: rotate(360deg); }
}
@keyframes pet-halo {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.65; }
}
@keyframes pet-light {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}
</style>

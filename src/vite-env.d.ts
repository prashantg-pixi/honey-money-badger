/// <reference types="vite/client" />

// Build-time deployment facts go here as `ImportMetaEnv` members when a target needs them (a REST base
// URL, an operator origin). The `offline` target needs none: it reads only `import.meta.env.DEV` to
// gate the dev overlay. Credentials never belong in an artifact — they arrive at runtime in the launch
// context (NFR-SEC-1).

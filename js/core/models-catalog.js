// Catalogue exhaustif des modèles par provider — base de données pour Settings UI
// Chaque entrée : { tier, label, context, pricing: { input, output } } (pricing en USD/1M tokens)

export const MODEL_CATALOG = {
  claude: [
    { id: 'claude-opus-4-7',           tier: 'flagship', label: 'Opus 4.7 (latest)',     context: 200000, pricing: { input: 15, output: 75 }, recommended: true },
    { id: 'claude-opus-4-5',           tier: 'flagship', label: 'Opus 4.5',              context: 200000, pricing: { input: 15, output: 75 } },
    { id: 'claude-sonnet-4-6',         tier: 'balanced', label: 'Sonnet 4.6 (latest)',   context: 200000, pricing: { input: 3,  output: 15 }, recommended: true },
    { id: 'claude-sonnet-4-5',         tier: 'balanced', label: 'Sonnet 4.5',            context: 200000, pricing: { input: 3,  output: 15 } },
    { id: 'claude-haiku-4-5',          tier: 'fast',     label: 'Haiku 4.5',             context: 200000, pricing: { input: 0.8, output: 4 }, recommended: true },
    { id: 'claude-haiku-4-5-20251001', tier: 'fast',     label: 'Haiku 4.5 (pinned)',    context: 200000, pricing: { input: 0.8, output: 4 } },
  ],
  openai: [
    { id: 'gpt-5',         tier: 'flagship', label: 'GPT-5',          context: 200000, pricing: { input: 5,    output: 15  }, recommended: true },
    { id: 'gpt-5-mini',    tier: 'balanced', label: 'GPT-5 Mini',     context: 200000, pricing: { input: 1,    output: 4   }, recommended: true },
    { id: 'gpt-5-nano',    tier: 'fast',     label: 'GPT-5 Nano',     context: 128000, pricing: { input: 0.2,  output: 0.8 }, recommended: true },
    { id: 'o1',            tier: 'flagship', label: 'o1 (reasoning)', context: 200000, pricing: { input: 15,   output: 60  } },
    { id: 'o1-mini',       tier: 'balanced', label: 'o1-mini',        context: 128000, pricing: { input: 3,    output: 12  } },
    { id: 'gpt-4o',        tier: 'balanced', label: 'GPT-4o',         context: 128000, pricing: { input: 2.5,  output: 10  } },
    { id: 'gpt-4o-mini',   tier: 'fast',     label: 'GPT-4o mini',    context: 128000, pricing: { input: 0.15, output: 0.6 } },
  ],
  gemini: [
    { id: 'gemini-2.5-pro',         tier: 'flagship', label: 'Gemini 2.5 Pro',         context: 2000000, pricing: { input: 1.25, output: 10  }, recommended: true },
    { id: 'gemini-2.5-flash',       tier: 'balanced', label: 'Gemini 2.5 Flash',       context: 1000000, pricing: { input: 0.3,  output: 2.5 }, recommended: true },
    { id: 'gemini-2.5-flash-lite',  tier: 'fast',     label: 'Gemini 2.5 Flash-Lite',  context: 1000000, pricing: { input: 0.1,  output: 0.4 }, recommended: true },
    { id: 'gemini-2.0-flash',       tier: 'balanced', label: 'Gemini 2.0 Flash',       context: 1000000, pricing: { input: 0.1,  output: 0.4 } },
    { id: 'gemini-2.0-flash-lite',  tier: 'fast',     label: 'Gemini 2.0 Flash-Lite',  context: 1000000, pricing: { input: 0.075,output: 0.3 } },
  ],
  grok: [
    { id: 'grok-4',       tier: 'flagship', label: 'Grok 4',         context: 256000, pricing: { input: 5, output: 15 }, recommended: true },
    { id: 'grok-4-fast',  tier: 'fast',     label: 'Grok 4 Fast',    context: 256000, pricing: { input: 1, output: 5  }, recommended: true },
    { id: 'grok-3',       tier: 'balanced', label: 'Grok 3',         context: 128000, pricing: { input: 3, output: 12 } },
    { id: 'grok-3-mini',  tier: 'fast',     label: 'Grok 3 mini',    context: 128000, pricing: { input: 0.3, output: 1 } },
  ],
  openrouter: [
    // Modèles populaires via OpenRouter — pricing approximatif (varie selon modèle exact)
    { id: 'anthropic/claude-opus-4',         tier: 'flagship', label: 'Claude Opus 4 (via OR)',     context: 200000, pricing: { input: 15,   output: 75   }, recommended: true },
    { id: 'anthropic/claude-sonnet-4',       tier: 'flagship', label: 'Claude Sonnet 4 (via OR)',   context: 200000, pricing: { input: 3,    output: 15   } },
    { id: 'anthropic/claude-3.5-sonnet',     tier: 'balanced', label: 'Claude 3.5 Sonnet (via OR)', context: 200000, pricing: { input: 3,    output: 15   } },
    { id: 'openai/gpt-5',                    tier: 'flagship', label: 'GPT-5 (via OR)',             context: 200000, pricing: { input: 5,    output: 15   } },
    { id: 'openai/gpt-5-mini',               tier: 'balanced', label: 'GPT-5 Mini (via OR)',        context: 200000, pricing: { input: 1,    output: 4    }, recommended: true },
    { id: 'openai/gpt-4o',                   tier: 'balanced', label: 'GPT-4o (via OR)',            context: 128000, pricing: { input: 2.5,  output: 10   } },
    { id: 'google/gemini-2.5-pro',           tier: 'flagship', label: 'Gemini 2.5 Pro (via OR)',    context: 2000000,pricing: { input: 1.25, output: 10   } },
    { id: 'google/gemini-2.5-flash',         tier: 'balanced', label: 'Gemini 2.5 Flash (via OR)',  context: 1000000,pricing: { input: 0.3,  output: 2.5  } },
    { id: 'meta-llama/llama-3.3-70b-instruct', tier: 'fast',   label: 'Llama 3.3 70B (via OR)',     context: 128000, pricing: { input: 0.13, output: 0.4  }, recommended: true },
    { id: 'deepseek/deepseek-chat',          tier: 'fast',     label: 'DeepSeek V3 (via OR)',       context: 128000, pricing: { input: 0.14, output: 0.28 } },
    { id: 'mistralai/mistral-large-latest',  tier: 'balanced', label: 'Mistral Large (via OR)',     context: 128000, pricing: { input: 2,    output: 6    } },
    { id: 'qwen/qwen-2.5-72b-instruct',      tier: 'fast',     label: 'Qwen 2.5 72B (via OR)',      context: 128000, pricing: { input: 0.35, output: 0.4  } },
  ],
  perplexity: [
    { id: 'sonar-pro',         tier: 'flagship', label: 'Sonar Pro',         context: 200000, pricing: { input: 3,   output: 15  }, recommended: true },
    { id: 'sonar',             tier: 'balanced', label: 'Sonar',             context: 128000, pricing: { input: 1,   output: 1   }, recommended: true },
    { id: 'sonar-reasoning',   tier: 'balanced', label: 'Sonar Reasoning',   context: 128000, pricing: { input: 1,   output: 5   } },
    { id: 'sonar-reasoning-pro', tier: 'flagship', label: 'Sonar Reasoning Pro', context: 200000, pricing: { input: 2, output: 8 } },
    { id: 'sonar-deep-research', tier: 'flagship', label: 'Sonar Deep Research', context: 200000, pricing: { input: 2, output: 8 } },
  ],
  mistral: [
    { id: 'mistral-large-latest',   tier: 'flagship', label: 'Mistral Large',   context: 128000, pricing: { input: 2,    output: 6    }, recommended: true },
    { id: 'mistral-medium-latest',  tier: 'balanced', label: 'Mistral Medium',  context: 128000, pricing: { input: 0.4,  output: 2    }, recommended: true },
    { id: 'mistral-small-latest',   tier: 'fast',     label: 'Mistral Small',   context: 128000, pricing: { input: 0.2,  output: 0.6  }, recommended: true },
    { id: 'codestral-latest',       tier: 'balanced', label: 'Codestral',       context: 256000, pricing: { input: 0.3,  output: 0.9  } },
    { id: 'pixtral-large-latest',   tier: 'flagship', label: 'Pixtral Large',   context: 128000, pricing: { input: 2,    output: 6    } },
  ],
  cerebras: [
    { id: 'llama-3.3-70b',          tier: 'flagship', label: 'Llama 3.3 70B (ultra-fast)', context: 128000, pricing: { input: 0.85, output: 1.2  }, recommended: true },
    { id: 'qwen-3-32b',             tier: 'balanced', label: 'Qwen3 32B',                  context: 128000, pricing: { input: 0.4,  output: 0.8  }, recommended: true },
    { id: 'llama-3.1-8b',           tier: 'fast',     label: 'Llama 3.1 8B',               context: 128000, pricing: { input: 0.1,  output: 0.1  }, recommended: true },
  ],
  github: [
    // GitHub Models has free tier (rate-limited). Pricing kept at 0 — costs hit your GitHub quota.
    { id: 'openai/gpt-4o',                       tier: 'flagship', label: 'GPT-4o (GitHub)',            context: 128000, pricing: { input: 0,    output: 0    }, recommended: true },
    { id: 'openai/gpt-4o-mini',                  tier: 'balanced', label: 'GPT-4o mini (GitHub)',       context: 128000, pricing: { input: 0,    output: 0    }, recommended: true },
    { id: 'meta/Llama-3.3-70B-Instruct',         tier: 'balanced', label: 'Llama 3.3 70B (GitHub)',     context: 128000, pricing: { input: 0,    output: 0    } },
    { id: 'meta/Llama-3.2-11B-Vision-Instruct',  tier: 'fast',     label: 'Llama 3.2 11B Vision',       context: 128000, pricing: { input: 0,    output: 0    }, recommended: true },
    { id: 'mistral-ai/Mistral-Large-2411',       tier: 'flagship', label: 'Mistral Large 2411',         context: 128000, pricing: { input: 0,    output: 0    } },
    { id: 'cohere/Cohere-command-r-plus',        tier: 'balanced', label: 'Command R+ (GitHub)',        context: 128000, pricing: { input: 0,    output: 0    } },
  ],
  nvidia: [
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', tier: 'flagship', label: 'Nemotron 70B',               context: 128000, pricing: { input: 0.5,  output: 0.5  }, recommended: true },
    { id: 'meta/llama-3.3-70b-instruct',            tier: 'balanced', label: 'Llama 3.3 70B (NIM)',        context: 128000, pricing: { input: 0.4,  output: 0.4  }, recommended: true },
    { id: 'meta/llama-3.1-405b-instruct',           tier: 'flagship', label: 'Llama 3.1 405B',             context: 128000, pricing: { input: 5,    output: 16   } },
    { id: 'meta/llama-3.1-8b-instruct',             tier: 'fast',     label: 'Llama 3.1 8B (NIM)',         context: 128000, pricing: { input: 0.05, output: 0.05 }, recommended: true },
    { id: 'mistralai/mixtral-8x22b-instruct-v0.1',  tier: 'balanced', label: 'Mixtral 8x22B',              context: 65000,  pricing: { input: 1.2,  output: 1.2  } },
  ],
  huggingface: [
    // Routés via /nebius/v1/chat/completions (cf huggingface.js). Connecte Nebius dans
    // huggingface.co/settings/inference-providers, sinon les calls retournent 404.
    // Pricing varies — values are typical (USD/1M tokens) chez Nebius.
    { id: 'meta-llama/Llama-3.3-70B-Instruct',        tier: 'flagship', label: 'Llama 3.3 70B (HF·Nebius)', context: 128000, pricing: { input: 0.7,  output: 0.9  }, recommended: true },
    { id: 'Qwen/Qwen2.5-72B-Instruct',                tier: 'balanced', label: 'Qwen2.5 72B (HF·Nebius)',   context: 128000, pricing: { input: 0.5,  output: 0.7  }, recommended: true },
    { id: 'meta-llama/Llama-3.1-8B-Instruct',         tier: 'fast',     label: 'Llama 3.1 8B (HF·Nebius)',  context: 128000, pricing: { input: 0.1,  output: 0.1  }, recommended: true },
    { id: 'deepseek-ai/DeepSeek-V3',                  tier: 'flagship', label: 'DeepSeek V3 (HF·Nebius)',   context: 128000, pricing: { input: 0.27, output: 1.1  } },
    { id: 'mistralai/Mistral-Nemo-Instruct-2407',     tier: 'balanced', label: 'Mistral Nemo (HF·Nebius)',  context: 128000, pricing: { input: 0.15, output: 0.15 } },
  ],
  cloudflare: [
    // Cloudflare Workers AI pricing per https://developers.cloudflare.com/workers-ai/platform/pricing/
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', tier: 'flagship', label: 'Llama 3.3 70B (CF fast)', context: 24000, pricing: { input: 0.29, output: 2.25 }, recommended: true },
    { id: '@cf/meta/llama-3.1-70b-instruct',          tier: 'balanced', label: 'Llama 3.1 70B (CF)',     context: 24000,  pricing: { input: 0.59, output: 0.79 } },
    { id: '@cf/meta/llama-3.1-8b-instruct',           tier: 'fast',     label: 'Llama 3.1 8B (CF)',      context: 8000,   pricing: { input: 0.15, output: 0.28 }, recommended: true },
    { id: '@cf/qwen/qwen2.5-coder-32b-instruct',      tier: 'balanced', label: 'Qwen 2.5 Coder 32B (CF)', context: 32000, pricing: { input: 0.66, output: 1   } },
    { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', tier: 'fast', label: 'Mistral Small 3.1 (CF)', context: 32000, pricing: { input: 0.35, output: 0.55 } },
  ],
  together: [
    { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',         tier: 'flagship', label: 'Llama 3.3 70B Turbo',     context: 128000, pricing: { input: 0.88, output: 0.88 }, recommended: true },
    { id: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',   tier: 'flagship', label: 'Llama 3.1 405B Turbo',    context: 128000, pricing: { input: 3.5,  output: 3.5  } },
    { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo',                 tier: 'balanced', label: 'Qwen 2.5 72B Turbo',      context: 128000, pricing: { input: 1.2,  output: 1.2  }, recommended: true },
    { id: 'meta-llama/Llama-3.1-8B-Instruct-Turbo',          tier: 'fast',     label: 'Llama 3.1 8B Turbo',      context: 128000, pricing: { input: 0.18, output: 0.18 }, recommended: true },
    { id: 'deepseek-ai/DeepSeek-V3',                         tier: 'flagship', label: 'DeepSeek V3 (Together)',  context: 128000, pricing: { input: 1.25, output: 1.25 } },
    { id: 'mistralai/Mixtral-8x22B-Instruct-v0.1',           tier: 'balanced', label: 'Mixtral 8x22B (Together)', context: 65000, pricing: { input: 1.2,  output: 1.2  } },
  ],
  cohere: [
    { id: 'command-r-plus-08-2024',  tier: 'flagship', label: 'Command R+ (08-2024)',  context: 128000, pricing: { input: 2.5,  output: 10  }, recommended: true },
    { id: 'command-r-08-2024',       tier: 'balanced', label: 'Command R (08-2024)',   context: 128000, pricing: { input: 0.15, output: 0.6 }, recommended: true },
    { id: 'command-r7b-12-2024',     tier: 'fast',     label: 'Command R7B',           context: 128000, pricing: { input: 0.0375, output: 0.15 }, recommended: true },
    { id: 'command-a-03-2025',       tier: 'flagship', label: 'Command A',             context: 256000, pricing: { input: 2.5,  output: 10  } },
  ]
};

// Renvoie le modèle ID à utiliser pour un (provider, tier) en tenant compte des overrides utilisateur
export function resolveModel(providerName, tier, settings = {}) {
  const overrides = settings.modelOverrides || {};
  const fromOverride = overrides[providerName]?.[tier];
  if (fromOverride) return fromOverride;
  // Sinon : premier modèle marqué recommended du bon tier
  const cat = MODEL_CATALOG[providerName] || [];
  const match = cat.find(m => m.tier === tier && m.recommended) || cat.find(m => m.tier === tier) || cat[0];
  return match?.id || '';
}

// Tarification d'un modèle spécifique — match exact, sinon par prefix le plus long
// Permet de matcher "claude-opus-4-5-20251201" (avec date) à "claude-opus-4-5" du catalogue
export function modelPricing(providerName, modelId) {
  if (!modelId) return null;
  const cat = MODEL_CATALOG[providerName] || [];
  // 1. Exact match
  const exact = cat.find(m => m.id === modelId);
  if (exact) return exact.pricing;
  // 2. Prefix match — le plus long gagne
  const prefixed = cat.filter(m => modelId.startsWith(m.id) || m.id.startsWith(modelId.split(':')[0] || ''))
                      .sort((a, b) => b.id.length - a.id.length);
  if (prefixed[0]) return prefixed[0].pricing;
  // 3. Pas trouvé — log dev pour debug
  if (typeof console !== 'undefined') {
    console.warn(`[pricing] No match for "${modelId}" in ${providerName} catalog`);
  }
  return null;
}

// Liste plate (tous modèles, label "provider · model")
export function allModels() {
  const out = [];
  for (const [provider, list] of Object.entries(MODEL_CATALOG)) {
    for (const m of list) out.push({ provider, ...m });
  }
  return out;
}

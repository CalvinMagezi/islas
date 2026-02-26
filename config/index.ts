// @ts-nocheck
import { oakstoneConfig } from "./oakstone";

const configs: Record<string, any> = {
    oakstone: oakstoneConfig,
    default: {
        brand: {
            name: "Islas",
            colors: {}
        },
        persona: {
            systemInstructions: "You are Islas, a helpful AI assistant."
        },
        features: {},
        modelPreferences: {
            defaultModel: "anthropic/claude-3-7-sonnet"
        },
        glossary: {}
    }
};

const tenantEnv = process.env.TENANT_CONFIG || "default";

export const activeConfig = configs[tenantEnv] || configs.default;

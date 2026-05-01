export {
  type AiSdkTool,
  type AiSdkToolMode,
  aiSdkTools,
} from "./client/adapters/ai-sdk.ts";
export {
  handleOpenAiToolCall,
  type OpenAiFunctionDef,
  openaiTools,
} from "./client/adapters/openai.ts";
export {
  connect,
  type HelmClientOptions,
  type HelmSession,
} from "./client/helm-client.ts";

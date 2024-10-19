import { IBasePerTenantAndOrganizationEntityModel } from '../base-entity.model'
import { ICopilot } from './copilot.model'

export interface IAiModel extends IBasePerTenantAndOrganizationEntityModel {
  /**
   * 模型名称
   */
  name: string

  /**
   * 模型展示名称
   */
  label: string

  /**
   * 模型类型
   */
  modelType: string

  /**
   * 模型特性
   */
  features: string[]

  /**
   * 模型属性
   */
  modelProperties: Record<string, any>

  /**
   * 参数规则
   */
  parameterRules: Record<string, any>[]

  /**
   * 定价信息
   */
  pricing: {
    input: string
    output: string
    unit: string
    currency: string
  }

  /**
   * 是否已废弃
   */
  deprecated: boolean
}

export enum ModelType {
  LLM = "llm",
  TEXT_EMBEDDING = "text-embedding",
  RERANK = "rerank",
  SPEECH2TEXT = "speech2text",
  MODERATION = "moderation",
  TTS = "tts",
  TEXT2IMG = "text2img"
}

export enum ProviderType {
  CUSTOM = 'custom',
  SYSTEM = 'system'
}

export interface ICopilotWithProvider extends ICopilot {
  providerWithModels: Partial<IProviderEntity>
}

export interface IProviderEntity {
  provider: string;
  label: I18nObject;
  description: I18nObject;
  icon_small: I18nObject;
  icon_large: I18nObject;
  background: string;
  help: ProviderHelpInfo;
  supported_model_types: ModelType[];
  configurate_methods: ConfigurateMethod[];
  model_credential_schema: ProviderCredentialSchema;
  provider_credential_schema: ProviderCredentialSchema;
  models: ProviderModel[]
}

export interface ProviderHelpInfo {
  title: I18nObject;
  url: I18nObject;
}

export interface I18nObject {
  en_US: string;
  zh_Hans?: string;
}

export interface ProviderModel {
  model: string;
  label: I18nObject;
  model_type: ModelType;
  features?: ModelFeature[];
  fetchFrom: FetchFrom;
  modelProperties: Record<ModelPropertyKey, any>;
  deprecated?: boolean;
  modelConfig?: any;
}

export interface ProviderCredentialSchema {
  model?: {
    label: I18nObject;
    placeholder: I18nObject;
  };
  credential_form_schemas: CredentialFormSchema[];
}

export interface CredentialFormSchema {
  variable: string;
  label: I18nObject;
  type: string;
  required: boolean;
  placeholder: I18nObject;
}

export enum FetchFrom {
  PREDEFINED_MODEL = "predefined-model",
  CUSTOMIZABLE_MODEL = "customizable-model"
}

export enum ModelFeature {
  TOOL_CALL = "tool-call",
  MULTI_TOOL_CALL = "multi-tool-call",
  AGENT_THOUGHT = "agent-thought",
  VISION = "vision",
  STREAM_TOOL_CALL = "stream-tool-call"
}

export enum ModelPropertyKey {
  MODE = "mode",
  CONTEXT_SIZE = "context_size",
  MAX_CHUNKS = "max_chunks",
  FILE_UPLOAD_LIMIT = "file_upload_limit",
  SUPPORTED_FILE_EXTENSIONS = "supported_file_extensions",
  MAX_CHARACTERS_PER_CHUNK = "max_characters_per_chunk",
  DEFAULT_VOICE = "default_voice",
  VOICES = "voices",
  WORD_LIMIT = "word_limit",
  AUDIO_TYPE = "audio_type",
  MAX_WORKERS = "max_workers"
}

export enum ConfigurateMethod {
  PREDEFINED_MODEL = 'predefined-model',
  CUSTOMIZABLE_MODEL = 'customizable-model'
}

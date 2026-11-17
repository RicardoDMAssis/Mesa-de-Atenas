export {
  API_VERSION,
  type Manifest,
  manifestSchema,
  PERMISSIONS,
  type Permission,
} from "./manifest";
export {
  METHODS,
  type MethodName,
  type MethodParams,
  PERMISSION_LABELS,
  type PluginContext,
  type PluginEvents,
  STORAGE_VALUE_MAX,
  SURFACES,
  type Surface,
  type ThemePayload,
} from "./methods";
export {
  type HostMessage,
  INIT_MESSAGE_TYPE,
  type PluginMessage,
  pluginMessageSchema,
  type RpcError,
} from "./protocol";

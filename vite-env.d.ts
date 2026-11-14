interface ImportMetaEnv {
  readonly VITE_TUTOR_BRIDGE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*?worker" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

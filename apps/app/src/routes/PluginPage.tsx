import { useParams } from "react-router";
import { PluginSurface } from "../plugin-host/PluginSurface";

/** Tela própria de um plugin (ponto de extensão `page`). */
export function PluginPage() {
  const { pluginId = "" } = useParams();
  return (
    <div className="-mx-4 -my-6 h-[calc(100dvh-3.5rem-env(safe-area-inset-bottom))] md:-mx-8 md:-my-10 md:h-dvh">
      <PluginSurface key={pluginId} pluginId={pluginId} surface="page" />
    </div>
  );
}

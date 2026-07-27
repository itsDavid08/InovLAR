// @ts-check
import { useState } from "react";
import { DISPOSITIVOS, defaultConfig } from "./constants";

/** @typedef {import('./constants').TabelaConfig} TabelaConfig */

/** @returns {Object<string, TabelaConfig>} */
const configsVazias = () =>
    // Object.keys() devolve string[] em TS, mesmo quando as chaves reais são só
    // as de DISPOSITIVOS — cast honesto, não um @ts-ignore às cegas.
    Object.fromEntries(
        Object.keys(DISPOSITIVOS).map((d) => [
            d,
            defaultConfig(/** @type {keyof typeof DISPOSITIVOS} */ (d)),
        ])
    );

// Estado partilhado dos 3 layouts (por dispositivo) de um editor de tabelas.
// GerirTabela (por utente) e GerirTemplate (por template) só diferem em como
// carregam e gravam os dados — trocar de separador, editar um campo, e saber
// o que está "por gravar" é igual nos dois, e estava duplicado entre eles.
/**
 * @returns {{
 *   configs: Object<string, TabelaConfig>,
 *   setConfigs: React.Dispatch<React.SetStateAction<Object<string, TabelaConfig>>>,
 *   dispositivo: string,
 *   setDispositivo: React.Dispatch<React.SetStateAction<string>>,
 *   cfg: TabelaConfig,
 *   patch: (parcial: Partial<TabelaConfig>) => void,
 *   dirtyDevices: Set<string>,
 *   dirty: boolean,
 *   markClean: () => void,
 * }}
 */
export function useTabelaConfigs() {
    const [configs, setConfigs] = useState(configsVazias);
    const [dispositivo, setDispositivo] = useState("pc");
    // Dispositivos com alterações por gravar. GerirTabela usa o conjunto para só
    // fazer PUT dos dispositivos tocados; GerirTemplate só olha para o tamanho
    // (guarda sempre o template inteiro), mas a proveniência é a mesma.
    const [dirtyDevices, setDirtyDevices] = useState(() => new Set());

    const cfg = configs[dispositivo];

    // Aplica um patch parcial ao dispositivo atual e marca-o como sujo.
    const patch = (parcial) => {
        setConfigs((prev) => ({ ...prev, [dispositivo]: { ...prev[dispositivo], ...parcial } }));
        setDirtyDevices((prev) => new Set(prev).add(dispositivo));
    };

    const markClean = () => setDirtyDevices(new Set());

    return {
        configs,
        setConfigs, // para o carregamento inicial (não deve marcar dirty — usar diretamente)
        dispositivo,
        setDispositivo,
        cfg,
        patch,
        dirtyDevices,
        dirty: dirtyDevices.size > 0,
        markClean,
    };
}

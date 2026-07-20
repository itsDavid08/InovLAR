import { useEffect, useRef } from "react";

// Toca o alarme em loop enquanto `ativo` for true; pausa e rebobina quando
// deixa de ser (ou ao desmontar). Antes era um useEffect sem array de
// dependências no TabuleiroComunicacao — corria em todos os renders, o que
// fazia pause+play a cada mudança de estado (glitches de áudio). Com `[ativo]`
// só reage à transição, mantendo o som contínuo entre re-renders.
export function useAlarmeEmergencia(ativo, src = "/Warning-alarm-tone.mp3") {
    const audioRef = useRef(null);
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio(src);
            audioRef.current.loop = true;
        }
        const audio = audioRef.current;
        if (ativo) {
            audio.play().catch(() => {}); // autoplay pode ser bloqueado até haver interação
        } else {
            audio.pause();
            audio.currentTime = 0;
        }
        return () => {
            audio.pause();
            audio.currentTime = 0;
        };
    }, [ativo, src]);
}

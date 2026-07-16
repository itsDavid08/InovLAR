import { useEffect, useState } from "react";

// Transient feedback state for <FeedbackToast/>: { tipo: "ok" | "erro", texto }.
// Auto-dismisses after `timeoutMs`. Was duplicated across GerirTabela,
// GerirTemplate and TabelasView.
export function useFeedback(timeoutMs = 3000) {
    const [feedback, setFeedback] = useState(null);
    useEffect(() => {
        if (!feedback) return;
        const t = setTimeout(() => setFeedback(null), timeoutMs);
        return () => clearTimeout(t);
    }, [feedback, timeoutMs]);
    return [feedback, setFeedback];
}

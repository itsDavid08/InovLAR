// Bottom-center toast for transient feedback. Pairs with useFeedback():
//   const [feedback, setFeedback] = useFeedback();
//   ... setFeedback({ tipo: "ok", texto: "Guardado" });
//   <FeedbackToast feedback={feedback} />
const FeedbackToast = ({ feedback, zClass = "z-50" }) => {
    if (!feedback) return null;
    const ok = feedback.tipo === "ok";
    return (
        <div
            role="status"
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${zClass} flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-staff-mono font-semibold ${ok ? "bg-primary text-on-primary" : "bg-error text-on-error"}`}
        >
            <span className="material-symbols-outlined text-[20px]">
                {ok ? "check_circle" : "error"}
            </span>
            {feedback.texto}
        </div>
    );
};

export default FeedbackToast;

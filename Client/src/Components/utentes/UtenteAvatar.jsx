// Avatar do utente, em três modos, escolhidos pelo campo `imagem`:
//   - caminho ('/imagesUtentes/…')  → foto pessoal carregada
//   - ICONE_PESSOA ('icone')        → ícone de pessoa, sobre a cor de fundo
//   - '' / null                     → iniciais do nome, sobre a cor de fundo
// A cor de fundo (`corAvatar`) recolore tanto o ícone como as iniciais.
// O tamanho vem do `className` (largura/altura + text-size, que o ícone e as
// iniciais herdam via font-size).
export const ICONE_PESSOA = 'icone';

export const iniciaisDe = (nome) =>
    (nome || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

const UtenteAvatar = ({ imagem, corAvatar, nome, apiUrl = "", className = "" }) => {
    const ehFoto = imagem && imagem !== ICONE_PESSOA;
    if (ehFoto) {
        return (
            <img
                src={`${apiUrl}${imagem}`}
                alt={nome || "Foto"}
                className={`object-cover rounded-full ${className}`}
            />
        );
    }
    return (
        <div
            className={`bg-secondary-container text-on-secondary-container flex items-center justify-center rounded-full ${className}`}
            style={{ backgroundColor: corAvatar || undefined }}
        >
            {imagem === ICONE_PESSOA
                ? <span className="material-symbols-outlined" style={{ fontSize: "1.6em" }}>person</span>
                : (iniciaisDe(nome) || "?")}
        </div>
    );
};

export default UtenteAvatar;

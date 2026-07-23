import { defineConfig } from "vitest/config";

// globals: true → describe/it/expect/vi disponíveis sem import. Necessário para os
// testes escritos em CommonJS (.test.cjs), que precisam de partilhar o registo de
// módulos CJS com o código-fonte (require) — ver boardController.updatePedido.test.cjs.
export default defineConfig({
    test: { globals: true },
});

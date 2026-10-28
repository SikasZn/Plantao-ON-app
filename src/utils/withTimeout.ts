// src/utils/withTimeout.ts
//
// Sem internet decente, uma requisição pode ficar pendurada por minutos — e
// o botão "Salvar" ficaria em "carregando" o tempo todo, parecendo que o app
// travou. Com um limite, a tela volta a responder e mostra o erro.
export function withTimeout<T>(promise: PromiseLike<T>, ms = 25000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('A conexão demorou demais. Verifique sua internet e confira se o item foi salvo antes de tentar de novo.')),
      ms
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

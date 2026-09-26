export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Sem 0/O e 1/I para evitar confusão ao digitar o código.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCodexCode(existing: string[]): string {
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  } while (existing.includes(code));
  return code;
}

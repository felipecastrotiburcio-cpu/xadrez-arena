import { assertEquals } from 'jsr:@std/assert@1.0.13';
import { checkDevPassword } from './devMode.ts';

Deno.test('modo desenvolvedor: senhas erradas são recusadas', async () => {
  for (const pw of ['', 'senha', 'senha-errada-123', 'x'.repeat(500)]) assertEquals(await checkDevPassword(pw), false);
});

// A senha certa não fica no repositório (ele é público): só é testada quando vem de fora.
Deno.test({
  name: 'modo desenvolvedor: a senha certa é aceita',
  ignore: !Deno.env.get('DEV_MODE_PASSWORD'),
  fn: async () => assertEquals(await checkDevPassword(Deno.env.get('DEV_MODE_PASSWORD')!), true),
});

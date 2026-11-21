import type { Lang } from './i18n';
import type { Tier } from './training';
import type { Puzzle } from './puzzles';

/** Textos das lições do treino (título, explicação e dica de cada tema), em português e inglês. */
interface Lesson {
  title: string;
  text: string;
  hint: string;
}

const PT: Record<string, Lesson> = {
  move_rook: { title: 'A torre anda em linha reta', text: 'A torre anda quantas casas quiser para a frente, para trás e para os lados, sem pular peças.', hint: 'Siga a coluna ou a fileira da torre até a peça preta.' },
  move_bishop: { title: 'O bispo anda na diagonal', text: 'O bispo anda quantas casas quiser na diagonal e sempre fica na mesma cor de casa.', hint: 'Siga a diagonal do bispo até a peça preta.' },
  move_knight: { title: 'O cavalo pula em "L"', text: 'O cavalo anda duas casas para um lado e uma para o outro, formando um "L". Ele pode pular por cima das peças!', hint: 'Conte duas casas e vire uma: onde está a dama preta?' },
  move_queen: { title: 'A dama é a peça mais forte', text: 'A dama anda como a torre e como o bispo juntos: em linha reta e na diagonal.', hint: 'Olhe a coluna da dama.' },
  move_pawn: { title: 'O peão captura na diagonal', text: 'O peão anda para a frente, mas captura de um jeito diferente: uma casa na diagonal.', hint: 'A peça preta está na diagonal do peão.' },
  move_king: { title: 'O rei também captura', text: 'O rei anda uma casa para qualquer lado. Ele pode capturar uma peça que não esteja protegida.', hint: 'A dama preta está colada no seu rei e sozinha.' },
  escape_check: { title: 'Saia do xeque', text: 'Seu rei está em xeque! Dá para fugir, colocar uma peça na frente ou capturar quem ataca. Aqui, capturar é o melhor.', hint: 'Quem está dando o xeque? Seu peão alcança essa peça?' },
  promotion: { title: 'Promoção do peão', text: 'Quando o peão chega na última fileira, ele vira outra peça. Quase sempre a melhor escolha é a dama!', hint: 'Avance o peão até a última fileira e escolha a dama.' },
  mate_backrank: { title: 'Mate do corredor', text: 'O rei ficou preso atrás dos próprios peões. Um xeque na última fileira e ele não tem para onde fugir!', hint: 'Leve sua peça até a fileira do rei preto.' },
  mate_queen: { title: 'Mate com dama e rei', text: 'Seu rei protege a dama, e a dama encurrala o rei inimigo na beirada do tabuleiro.', hint: 'Procure um xeque em que o rei preto não tenha nenhuma casa livre.' },
  mate_rook: { title: 'Mate com torre e rei', text: 'Seu rei fecha as casas de fuga e a torre dá o xeque na beirada.', hint: 'A torre pode dar xeque na última fileira.' },
  mate_scholar: { title: 'Mate do Pastor', text: 'A casa f7 só é defendida pelo rei. Com a dama e o bispo juntos mirando nela, é mate!', hint: 'Dama e bispo miram na mesma casa ao lado do rei.' },
  hanging: { title: 'Peça de graça', text: 'Antes de jogar, procure peças do adversário sem proteção. Capturar de graça é sempre bom!', hint: 'A dama preta está desprotegida. Quem alcança ela?' },
  fork_knight: { title: 'Garfo de cavalo', text: 'O cavalo pode atacar duas peças ao mesmo tempo. Dê xeque no rei e, depois, capture a outra peça!', hint: 'Procure uma casa em que o cavalo ataque o rei e a dama juntos.' },
  mate_ladder: { title: 'Mate da escada', text: 'Duas torres trabalham juntas: uma fecha uma fileira e a outra dá o xeque na seguinte.', hint: 'Uma torre já fecha a fileira 7. Use a outra.' },
  mate_queen_bishop: { title: 'Dama e bispo juntos', text: 'O bispo protege a dama bem do lado do rei inimigo, e o rei não consegue capturá-la.', hint: 'A dama vai para uma casa colada no rei, protegida pelo bispo.' },
  mate_battery: { title: 'Bateria', text: 'Duas peças na mesma linha: a de trás protege a da frente na hora do ataque.', hint: 'A dama ataca na coluna e a torre logo atrás protege.' },
  mate_damiano: { title: 'Mate com apoio do peão', text: 'Um peão bem colocado protege a dama no golpe final perto do rei.', hint: 'O peão protege uma casa colada no rei preto.' },
  pin: { title: 'Cravada', text: 'Uma peça cravada não pode sair do lugar, senão deixa o rei em xeque. Ataque essa peça de novo!', hint: 'O cavalo preto está preso na frente do rei. Ataque-o com um peão.' },
  skewer: { title: 'Espeto', text: 'Dê xeque no rei. Quando ele sair do caminho, capture a peça que estava atrás dele.', hint: 'Coloque a torre na mesma fileira do rei e da dama.' },
  discovered: { title: 'Ataque descoberto', text: 'Mexa uma peça e revele o ataque de outra que estava escondida atrás. Assim dá para atacar duas coisas!', hint: 'Quando o cavalo sai, o bispo dá xeque. Para onde o cavalo vai?' },
  mate_smothered: { title: 'Mate abafado', text: 'O rei está cercado pelas próprias peças, e o cavalo pula por cima delas para dar o xeque final.', hint: 'Qual casa do cavalo dá xeque no canto?' },
  mate_arabian: { title: 'Mate árabe', text: 'A torre e o cavalo trabalham juntos para prender o rei no canto do tabuleiro.', hint: 'O cavalo já protege as casas certas. Falta a torre.' },
  mate1: { title: 'Mate em 1', text: 'Encontre o lance que dá xeque-mate agora. Confira todas as casas de fuga do rei!', hint: 'Comece pelos xeques: qual deles não deixa o rei escapar?' },
  mate2_sacrifice: { title: 'Sacrifício para dar mate', text: 'Às vezes vale entregar a dama para abrir caminho ao mate. Pense dois lances à frente!', hint: 'Um xeque com a dama obriga uma peça preta a sair do lugar.' },
  mate2_smothered: { title: 'Mate de Philidor', text: 'Sacrifique a dama para a torre tapar a fuga do rei e dê o mate abafado com o cavalo.', hint: 'A dama dá xeque numa casa colada no rei.' },
  mate2_legal: { title: 'Mate de Légal', text: 'Uma armadilha famosa: deixe a sua dama ser capturada e dê mate com as peças menores!', hint: 'Comece com um xeque de cavalo.' },
  mate2_check: { title: 'Mate em 2', text: 'Encontre o xeque que força o mate no lance seguinte, qualquer que seja a defesa.', hint: 'Teste os xeques e veja para onde o rei pode fugir depois.' },
  mate2_quiet: { title: 'Mate em 2 silencioso', text: 'O primeiro lance não é xeque: ele prepara uma rede de mate da qual não há saída.', hint: 'Feche as casas de fuga do rei antes de dar o xeque.' },
  mate2_sac: { title: 'Mate em 2 com sacrifício', text: 'Entregue uma peça para abrir as defesas do rei e dê mate no lance seguinte.', hint: 'O primeiro lance oferece uma peça com xeque.' },
};

const EN: Record<string, Lesson> = {
  move_rook: { title: 'The rook moves in straight lines', text: 'The rook moves any number of squares forward, backward or sideways, without jumping over pieces.', hint: "Follow the rook's file or rank to the black piece." },
  move_bishop: { title: 'The bishop moves diagonally', text: 'The bishop moves any number of squares diagonally and always stays on the same color.', hint: "Follow the bishop's diagonal to the black piece." },
  move_knight: { title: 'The knight jumps in an "L"', text: 'The knight moves two squares one way and one square the other, like an "L". It can jump over pieces!', hint: 'Count two squares and turn one: where is the black queen?' },
  move_queen: { title: 'The queen is the strongest piece', text: 'The queen moves like a rook and a bishop together: straight lines and diagonals.', hint: "Look along the queen's file." },
  move_pawn: { title: 'Pawns capture diagonally', text: 'The pawn moves forward, but captures differently: one square diagonally.', hint: 'The black piece is on the diagonal of your pawn.' },
  move_king: { title: 'The king can capture too', text: 'The king moves one square in any direction. It can capture a piece that is not protected.', hint: 'The black queen is right next to your king, all alone.' },
  escape_check: { title: 'Get out of check', text: 'Your king is in check! You can run, block, or capture the attacker. Here, capturing is best.', hint: 'Who is giving check? Can your pawn reach it?' },
  promotion: { title: 'Pawn promotion', text: 'When a pawn reaches the last rank it becomes another piece. The queen is almost always best!', hint: 'Push the pawn to the last rank and pick the queen.' },
  mate_backrank: { title: 'Back-rank mate', text: "The king is stuck behind its own pawns. A check on the last rank and it can't escape!", hint: "Bring your piece to the black king's rank." },
  mate_queen: { title: 'Mate with queen and king', text: "Your king protects the queen, and the queen traps the enemy king on the edge.", hint: 'Find a check that leaves the black king no free squares.' },
  mate_rook: { title: 'Mate with rook and king', text: 'Your king covers the escape squares and the rook gives check on the edge.', hint: 'The rook can check along the last rank.' },
  mate_scholar: { title: "Scholar's mate", text: 'The f7 square is only defended by the king. With the queen and bishop aiming at it, it is mate!', hint: 'Queen and bishop aim at the same square next to the king.' },
  hanging: { title: 'Free piece', text: "Before moving, look for unprotected enemy pieces. Capturing for free is always good!", hint: 'The black queen is unprotected. Who can reach it?' },
  fork_knight: { title: 'Knight fork', text: 'The knight can attack two pieces at once. Check the king, then capture the other piece!', hint: 'Find a square where the knight attacks the king and the queen together.' },
  mate_ladder: { title: 'Ladder mate', text: 'Two rooks work together: one closes a rank and the other gives check on the next one.', hint: 'One rook already closes the 7th rank. Use the other.' },
  mate_queen_bishop: { title: 'Queen and bishop together', text: "The bishop protects the queen right next to the enemy king, so the king can't take it.", hint: 'The queen goes next to the king, protected by the bishop.' },
  mate_battery: { title: 'Battery', text: 'Two pieces on the same line: the one behind protects the one in front.', hint: 'The queen attacks down the file and the rook behind protects it.' },
  mate_damiano: { title: 'Mate with pawn support', text: 'A well-placed pawn protects the queen for the final blow next to the king.', hint: 'The pawn protects a square next to the black king.' },
  pin: { title: 'Pin', text: 'A pinned piece cannot move or it would expose the king. Attack it again!', hint: 'The black knight is stuck in front of the king. Attack it with a pawn.' },
  skewer: { title: 'Skewer', text: 'Check the king. When it steps aside, capture the piece that was behind it.', hint: 'Put the rook on the same rank as the king and the queen.' },
  discovered: { title: 'Discovered attack', text: 'Move one piece to reveal an attack from another piece hidden behind it. Two threats at once!', hint: 'When the knight moves, the bishop gives check. Where should the knight go?' },
  mate_smothered: { title: 'Smothered mate', text: 'The king is surrounded by its own pieces, and the knight jumps over them for the final check.', hint: 'Which knight move gives check in the corner?' },
  mate_arabian: { title: 'Arabian mate', text: 'Rook and knight work together to trap the king in the corner.', hint: 'The knight already covers the right squares. Now the rook.' },
  mate1: { title: 'Mate in 1', text: "Find the move that gives checkmate right now. Check every escape square of the king!", hint: "Start with checks: which one leaves the king nowhere to go?" },
  mate2_sacrifice: { title: 'Sacrifice for mate', text: 'Sometimes giving up the queen opens the way to mate. Think two moves ahead!', hint: 'A queen check forces a black piece to move away.' },
  mate2_smothered: { title: "Philidor's mate", text: 'Sacrifice the queen so the rook blocks the king, then give smothered mate with the knight.', hint: 'The queen gives check right next to the king.' },
  mate2_legal: { title: "Légal's mate", text: 'A famous trap: let your queen be taken and mate with the minor pieces!', hint: 'Start with a knight check.' },
  mate2_check: { title: 'Mate in 2', text: 'Find the check that forces mate on the next move, whatever the defense.', hint: 'Try the checks and see where the king can run next.' },
  mate2_quiet: { title: 'Quiet mate in 2', text: "The first move is not a check: it builds a mating net with no way out.", hint: "Cover the king's escape squares before giving check." },
  mate2_sac: { title: 'Mate in 2 with a sacrifice', text: "Give up a piece to break the king's defenses and mate on the next move.", hint: 'The first move offers a piece with check.' },
};

export const lessonFor = (theme: string, lang: Lang): Lesson => (lang === 'en' ? EN : PT)[theme] ?? (lang === 'en' ? EN : PT).mate1;

const TIER_NAMES: Record<Lang, Record<Tier, { name: string; desc: string }>> = {
  pt: {
    1: { name: 'Primeiros passos', desc: 'Como as peças andam e os primeiros mates' },
    2: { name: 'Aprendiz', desc: 'Mates em 1, garfos e peças de graça' },
    3: { name: 'Tático', desc: 'Cravadas, espetos e ataques descobertos' },
    4: { name: 'Avançado', desc: 'Mates em 2 com xeque' },
    5: { name: 'Mestre', desc: 'Mates em 2 com sacrifício e lances silenciosos' },
  },
  en: {
    1: { name: 'First steps', desc: 'How the pieces move and the first mates' },
    2: { name: 'Apprentice', desc: 'Mates in 1, forks and free pieces' },
    3: { name: 'Tactician', desc: 'Pins, skewers and discovered attacks' },
    4: { name: 'Advanced', desc: 'Mates in 2 with check' },
    5: { name: 'Master', desc: 'Mates in 2 with sacrifices and quiet moves' },
  },
};
export const tierName = (tier: Tier, lang: Lang) => TIER_NAMES[lang === 'en' ? 'en' : 'pt'][tier];

/** Objetivo do desafio, em uma frase ("Brancas jogam e dão mate em 1"). */
export function goalText(p: Puzzle, lang: Lang) {
  const en = lang === 'en';
  if (p.goal === 'win') return en ? 'White to move and win material' : 'Brancas jogam e ganham material';
  if (p.moves.length >= 3) return en ? 'White to move and mate in 2' : 'Brancas jogam e dão mate em 2';
  return en ? 'White to move and mate in 1' : 'Brancas jogam e dão mate em 1';
}

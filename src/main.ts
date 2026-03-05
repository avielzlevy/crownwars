import { Game } from './Game';

const overlay = document.getElementById('overlay')!;
const game    = new Game();

game.init().then(() => {
  overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    document.body.querySelector('canvas')?.requestPointerLock();
    game.start();
  }, { once: true });
});

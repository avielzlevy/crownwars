import { Game } from "./Game";

const overlay = document.getElementById("overlay")!;
const nameInput = document.getElementById("name-input") as HTMLInputElement;
const startBtn = document.getElementById("start-btn")!;
const swatches = Array.from(document.querySelectorAll<HTMLElement>(".swatch"));

// ── Swatch selection ──────────────────────────────────────────────────────────
let selectedColor = 0x3b82f6; // default: blue

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    swatches.forEach((s) => s.classList.remove("selected"));
    swatch.classList.add("selected");
    selectedColor = parseInt(swatch.dataset.color!, 16);
  });
});

const updateSwatches = (takenColors: Set<number>) => {
  swatches.forEach((swatch) => {
    const color = parseInt(swatch.dataset.color!, 16);
    // Gray out colors taken by others (but keep own selection usable)
    swatch.classList.toggle(
      "taken",
      takenColors.has(color) && color !== selectedColor,
    );
  });
};

// ── Game init ─────────────────────────────────────────────────────────────────
const game = new Game();
game.onTakenColorsChanged = updateSwatches;

// Clean disconnect on page refresh to prevent ghost players
window.addEventListener("beforeunload", () => game.destroy());

game.init().then(() => {
  let started = false;

  const startGame = () => {
    if (started) return;
    started = true;
    game.setName(nameInput.value.trim());
    game.setShirtColor(selectedColor);
    overlay.style.display = "none";
    document.body.querySelector("canvas")?.requestPointerLock();
    game.start();
  };

  startBtn.addEventListener("click", startGame);
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startGame();
  });
});

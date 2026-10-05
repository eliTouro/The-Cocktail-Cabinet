/** A uniformly random valid code. It is drawn once; createRound then freezes it. */
export function randomCode(settings, rng) {
  if (settings.repeats) return Array.from({ length: settings.pegs }, () => rng.int(0, settings.colours));
  const colours = Array.from({ length: settings.colours }, (_, colour) => colour);
  const code = [];
  while (code.length < settings.pegs) code.push(colours.splice(rng.int(0, colours.length), 1)[0]);
  return code;
}

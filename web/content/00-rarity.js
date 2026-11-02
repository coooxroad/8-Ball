/* Rarity of the things in the shop, 0 (일반) to 5 (시크릿): [name, colour] (the colour 'rainbow' is drawn as one).
   On a card only the colour shows; opened, the name is said.
   Every item in this folder carries its rarity as `rarity: n`; tools/check.js fails the build if one is missing or out of range.
   Cues and gloves also play a little differently (their `stat`, shown as bars on the opened card):
     a cue's stat: { power, spin, guide } in percent, each within ±STAT_MAX - the hardest stroke, how much the strike
       point turns the ball, how long the guide line - and adding up to STAT_SUM[rarity] (a rarer cue, a bigger total;
       more of one is less of another, so none is simply better);
     a glove's stat: { power, dial } - the steps the power (of 100) and the fine-aim dial (degrees) move in. The finger
       moves the same; a finer step is finer control. A rarer glove, finer steps (tools/check.js checks the order). */
/* Two marks under the rarity, on the card and opened: SFX (it has its own sound: `sound` on a cue, a ball set or a trail)
   and VFX (it adds effects of light beyond its look - lights thrown on the cloth, a shooting star, a glow: `vfx: true`). */
const RARITY = [['일반', '#aeb6bf'], ['희귀', '#3f8cff'], ['에픽', '#a95cff'], ['신화', '#ff4d5e'], ['전설', '#ffb52e'], ['시크릿', 'rainbow']];
const STAT_MAX = 12, STAT_SUM = [0, 4, 8, 12, 16, 20];
/* A cue given only as a reward (`reward: 'eight'`: for every 8볼 lesson done - never sold, never from a 당구드롭) may put
   everything into power, up to POWER_MAX (the power gauge runs on past violet to blue and mint for it, 10-ui.js). */
const POWER_MAX = 30;
// with no glove on
const BARE_HAND = { power: 2, dial: 0.12 };
if (typeof module !== 'undefined') module.exports = { RARITY, STAT_MAX, STAT_SUM, POWER_MAX, BARE_HAND };

/* Rarity of the things in the shop, 0 (일반) to 5 (시크릿): [name, colour] (the colour 'rainbow' is drawn as one).
   Looks only - nothing plays differently. On a card only the colour shows; opened, the name is said.
   Every item in this folder carries its rarity as `rarity: n`; tools/check.js fails the build if one is missing or out of range. */
const RARITY = [['일반', '#aeb6bf'], ['희귀', '#3f8cff'], ['에픽', '#a95cff'], ['신화', '#ff4d5e'], ['전설', '#ffb52e'], ['시크릿', 'rainbow']];
if (typeof module !== 'undefined') module.exports = { RARITY };

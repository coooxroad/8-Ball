/* Which physics this server plays by (web/physics.js PHYS_V; server/test checks the two agree). A device on another
   physics would see other shots than the room checks against, so it is not let into a ranked game or a friend's room
   (index.js: why 'update') - it is told to update instead. A device too old to say counts as 1, the physics before
   the version was kept. Raised whenever physics.js changes what a shot does. */
export const PHYS_V = 10;                            // 2-3: the contact model (PR #14); 4: the game physics; 5: the stroke (11-07); 6: the game physics with the cushion's roll; 7: 4구 roll-out, a red pair knocked apart; 8: balls run as far as on a real table; 9: the rules as they are (breaks, fouls, the 3쿠션 opening); 10: 2:2

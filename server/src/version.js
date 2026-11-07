/* Which physics this server plays by (web/physics.js PHYS_V; server/test checks the two agree). A device on another
   physics would see other shots than the room checks against, so it is not let into a ranked game or a friend's room
   (index.js: why 'update') - it is told to update instead. A device too old to say counts as 1, the physics before
   the version was kept. Raised whenever physics.js changes what a shot does. */
export const PHYS_V = 5;                            // 2-3: the contact model (PR #14); 4: back to the game physics (11-07); 5: the stroke, the cushion's roll

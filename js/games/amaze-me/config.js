/** Every tunable number for aMaze Me lives here, so the game can be rebalanced in one place. */

export const GRID = { cols: 12, rows: 9 };

export const BUILD_SECONDS = 75;
export const SOLVE_SECONDS = 90;
/** A maze nobody escapes counts as a full run plus this bonus, so a perfect trap beats a fast escape. */
export const DNF_BONUS_SECONDS = 30;
/** Hold times closer than this are a tie. */
export const TIE_RESOLUTION_SECONDS = 0.1;

export const PART_LIMITS = { wall: 38, arrow: 4, portal: 2 };

/** How far the runner sees, in cell widths, measured between cell centres. */
export const SIGHT_RADIUS = 2.25;
export const FLARE = { count: 2, radius: 4.5 };

export const MOVE_REPEAT_SECONDS = 0.13;

export const COUNTDOWN_STEPS = ['3', '2', '1'];
export const COUNTDOWN_STEP_SECONDS = 1;
export const GO_TEXT = 'Go!';
export const GO_VISIBLE_SECONDS = 0.7;
export const FLARE_FLASH_SECONDS = 0.6;
export const BUMP_FLASH_SECONDS = 0.3;
export const URGENT_SECONDS = 10;
export const WARN_SECONDS = 3;
export const REFUSAL_FLASH_SECONDS = 2;
export const TIME_UP_PAUSE_SECONDS = 1.2;
export const MAX_NAME_LENGTH = 12;

export const CANVAS = { width: 480, height: 360, cell: 40 };

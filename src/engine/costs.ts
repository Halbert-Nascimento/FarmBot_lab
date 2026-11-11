/**
 * What the script's own work costs, in deciticks: a tenth of a tick per operation or
 * assignment, half a tick per call. Commands cost what the GDD table says, with no extra.
 */
export const OPERATION_COST = 1;
export const ASSIGNMENT_COST = 1;
export const CALL_COST = 5;

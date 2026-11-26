/**
 * Shared TypeScript types and DTOs matching apps/solver-service/app/models.py
 */
// ========== Enums ==========
export var ProcessType;
(function (ProcessType) {
    ProcessType["CS"] = "CS";
    ProcessType["ACC"] = "ACC";
    ProcessType["NDR"] = "NDR";
    ProcessType["RETENTION"] = "RETENTION";
})(ProcessType || (ProcessType = {}));
export var OperatingCalendar;
(function (OperatingCalendar) {
    OperatingCalendar["ALL_365"] = "ALL_365";
    OperatingCalendar["EXCL_PH"] = "EXCL_PH";
    OperatingCalendar["EXCL_SUN_PH"] = "EXCL_SUN_PH";
})(OperatingCalendar || (OperatingCalendar = {}));
export var RoleType;
(function (RoleType) {
    RoleType["DEDICATED"] = "DEDICATED";
    RoleType["SHARED"] = "SHARED";
    RoleType["FLOAT_BACKUP"] = "FLOAT_BACKUP";
})(RoleType || (RoleType = {}));
export var AssignmentType;
(function (AssignmentType) {
    AssignmentType["PRIMARY"] = "PRIMARY";
    AssignmentType["SECONDARY_BACKUP"] = "SECONDARY_BACKUP";
})(AssignmentType || (AssignmentType = {}));
export var ShiftCode;
(function (ShiftCode) {
    ShiftCode["W"] = "W";
    ShiftCode["WO"] = "WO";
    ShiftCode["PH"] = "PH";
    ShiftCode["AL"] = "AL";
    ShiftCode["CO"] = "CO";
    ShiftCode["BK"] = "BK";
})(ShiftCode || (ShiftCode = {}));
export var LeaveType;
(function (LeaveType) {
    LeaveType["APPROVED_LEAVE"] = "APPROVED_LEAVE";
    LeaveType["COMP_OFF"] = "COMP_OFF";
})(LeaveType || (LeaveType = {}));
export var LeaveStatus;
(function (LeaveStatus) {
    LeaveStatus["PENDING"] = "PENDING";
    LeaveStatus["APPROVED"] = "APPROVED";
    LeaveStatus["REJECTED"] = "REJECTED";
})(LeaveStatus || (LeaveStatus = {}));
export var RosterStatus;
(function (RosterStatus) {
    RosterStatus["DRAFT"] = "DRAFT";
    RosterStatus["PUBLISHED"] = "PUBLISHED";
})(RosterStatus || (RosterStatus = {}));
// ========== Validation Results ==========
export var ViolationType;
(function (ViolationType) {
    ViolationType["P0_COVERAGE_GAP"] = "P0_COVERAGE_GAP";
    ViolationType["P0_LEAVE_LOCK"] = "P0_LEAVE_LOCK";
    ViolationType["P0_SINGLE_ASSIGNMENT_CAP"] = "P0_SINGLE_ASSIGNMENT_CAP";
    ViolationType["P1_WEEKLY_OFF"] = "P1_WEEKLY_OFF";
})(ViolationType || (ViolationType = {}));

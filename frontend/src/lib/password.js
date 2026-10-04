// Same rule the API enforces (passwordRule in backend/src/validators/validator.index.js),
// checked here first so mistakes show up next to the field.
export function passwordProblem(pw) {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (pw.length > 128) return "Use at most 128 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number.";
  return "";
}

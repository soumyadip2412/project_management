import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "../ui/Field";

/**
 * FILE: frontend/src/components/auth/PasswordInput.jsx
 * Toggling `type` between "password" and "text" reveals the value. The toggle
 * is a real button with aria-pressed, so its state is announced. forwardRef
 * plus {...props} make it a drop-in replacement for <Input>: <Field> can
 * inject id/aria-* into it like any other control.
 */
/** Password field with a show/hide toggle. Use inside <Field> for its label. */
const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} {...props} type={visible ? "text" : "password"} className="pr-10" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 flex h-7 w-8 -translate-y-1/2 items-center justify-center rounded text-subtlest hover:text-text"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
});

export default PasswordInput;

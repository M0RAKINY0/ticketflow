import { forwardRef, type InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', error, id, label, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={inputId}>{label}</label>
      <input
        ref={ref}
        id={inputId}
        className="field__control"
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        {...props}
      />
      {error ? <span id={errorId} className="field__error">{error}</span> : null}
    </div>
  );
});

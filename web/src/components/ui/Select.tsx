import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

export type SelectOption = { label: string; value: string };

export function Select({
  label,
  onValueChange,
  options,
  placeholder,
  value,
}: {
  label: string;
  onValueChange(value: string): void;
  options: SelectOption[];
  placeholder?: string;
  value?: string;
}) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger className="select-trigger" aria-label={label}>
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon><ChevronDown size={17} aria-hidden="true" /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="select-content" position="popper" sideOffset={6}>
            <SelectPrimitive.Viewport>
              {options.map((option) => (
                <SelectPrimitive.Item className="select-item" key={option.value} value={option.value}>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator><Check size={15} aria-hidden="true" /></SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

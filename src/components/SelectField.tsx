import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EMPTY_PLACEHOLDER, toRadixSelectValue, fromRadixSelectValue } from '@/lib/selectUtils';

export interface SelectOption {
  label: string;
  value: string | number | null | undefined;
}

export interface SelectFieldProps {
  label?: string;
  value?: string | number | null;
  onChange: (value: string | undefined) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
  triggerClassName?: string;
  /** If true, adds a "Keine Auswahl" option at the top */
  allowEmpty?: boolean;
  /** Custom label for the empty option (default: "Keine Auswahl") */
  emptyLabel?: string;
}

/**
 * A safe Select component that handles empty/null values properly
 * and never renders <Select.Item value="">
 */
export const SelectField = React.forwardRef<HTMLButtonElement, SelectFieldProps>(
  (
    {
      label,
      value,
      onChange,
      options,
      placeholder = 'Bitte auswählen...',
      disabled = false,
      required = false,
      error,
      className,
      triggerClassName,
      allowEmpty = false,
      emptyLabel = 'Keine Auswahl',
    },
    ref
  ) => {
    // Convert value to safe Radix value
    const safeValue = toRadixSelectValue(value);

    const handleValueChange = (newValue: string) => {
      const result = fromRadixSelectValue(newValue);
      onChange(result);
    };

    // Build options list with safe values
    const safeOptions = React.useMemo(() => {
      const result: { label: string; value: string }[] = [];

      // Add empty option if allowed
      if (allowEmpty) {
        result.push({
          label: emptyLabel,
          value: EMPTY_PLACEHOLDER,
        });
      }

      // Add regular options
      options.forEach((opt) => {
        const safeOptValue = toRadixSelectValue(opt.value);
        // Skip if this would create a duplicate placeholder
        if (safeOptValue === EMPTY_PLACEHOLDER && allowEmpty) {
          return;
        }
        result.push({
          label: opt.label,
          value: safeOptValue,
        });
      });

      return result;
    }, [options, allowEmpty, emptyLabel]);

    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <Label className={cn(error && 'text-destructive')}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Select value={safeValue} onValueChange={handleValueChange} disabled={disabled}>
          <SelectTrigger
            ref={ref}
            className={cn(
              error && 'border-destructive focus:ring-destructive',
              triggerClassName
            )}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {safeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

SelectField.displayName = 'SelectField';

export default SelectField;

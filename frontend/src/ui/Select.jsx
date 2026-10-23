import React from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({ value, onValueChange, options = [], placeholder = '선택해주세요', className = '' }) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange}>
      <RadixSelect.Trigger className={`select-trigger ${className}`}>
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon className="select-icon">
          <ChevronDown size={16} />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content className="select-content" position="popper" sideOffset={5}>
          <RadixSelect.Viewport className="select-viewport">
            {options.map((opt) => (
              <RadixSelect.Item key={opt.value} value={opt.value} className="select-item">
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="select-indicator">
                  <Check size={14} />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

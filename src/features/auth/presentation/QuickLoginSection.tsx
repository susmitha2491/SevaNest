import React from 'react';
import { Zap } from 'lucide-react';
import { QuickLoginRole, QUICK_LOGIN_ROLES } from './quickLoginRoles';

interface QuickLoginSectionProps {
  selectedRoleId: string | null;
  onSelectRole: (role: QuickLoginRole) => void;
  disabled?: boolean;
}

export const QuickLoginSection: React.FC<QuickLoginSectionProps> = ({
  selectedRoleId,
  onSelectRole,
  disabled = false,
}) => {
  const handleCardKeyDown = (e: React.KeyboardEvent, role: QuickLoginRole) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectRole(role);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '6px 8px',
        backgroundColor: 'var(--color-bg-app)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Zap size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <h3
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--color-navy)',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Quick Login — Select Your Role
          </h3>
        </div>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--color-primary)',
            backgroundColor: 'var(--color-primary-subtle)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '1px 6px',
            flexShrink: 0,
            lineHeight: 1.2,
          }}
        >
          4 Roles
        </span>
      </div>

      <p
        style={{
          fontSize: '11px',
          color: 'var(--color-text-secondary)',
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        Choose an administrative persona below to populate development credentials.
      </p>

      {/* Two-Column Grid: 2 cards per row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '4px',
          marginTop: '2px',
        }}
      >
        {QUICK_LOGIN_ROLES.map((role) => {
          const isSelected = selectedRoleId === role.id;
          return (
            <div
              key={role.id}
              role="button"
              tabIndex={0}
              onClick={() => !disabled && onSelectRole(role)}
              onKeyDown={(e) => handleCardKeyDown(e, role)}
              data-testid={`quick-login-card-${role.id}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '4px 6px',
                backgroundColor: isSelected ? 'var(--color-primary-subtle)' : 'var(--color-bg-surface)',
                border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all var(--transition-fast)',
                boxShadow: isSelected ? '0 0 0 1px var(--color-primary)' : 'var(--shadow-sm)',
                outline: 'none',
                gap: '2px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-app)',
                      color: isSelected ? '#ffffff' : 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all var(--transition-fast)',
                    }}
                  >
                    {role.icon}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {role.name}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                  title={role.email}
                >
                  {role.email}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
import React from 'react';
import UniversalBadge from './UniversalBadge';

const RoleBadge = ({ role, className = '' }) => {
  return (
    <UniversalBadge text={role} className={className} />
  );
};

export default RoleBadge;

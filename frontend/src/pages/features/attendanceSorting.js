const getTimestamp = value => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const getCreatedTimestamp = item => {
  const createdAt = getTimestamp(item.createdAt || item.enrollmentDate);
  if (createdAt !== null) return createdAt;

  const id = String(item._id || '');
  return /^[\da-f]{24}$/i.test(id) ? parseInt(id.slice(0, 8), 16) * 1000 : null;
};

const compareDates = (a, b, direction) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction * (a - b);
};

export const sortAttendanceChildren = (children, sortBy) => {
  const list = [...children];

  list.sort((a, b) => {
    const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
    const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();

    if (sortBy === 'nameAsc') return nameA.localeCompare(nameB);
    if (sortBy === 'nameDesc') return nameB.localeCompare(nameA);
    if (sortBy === 'yearYoungest' || sortBy === 'yearOldest') {
      const dobA = getTimestamp(a.dateOfBirth);
      const dobB = getTimestamp(b.dateOfBirth);
      return compareDates(dobA, dobB, sortBy === 'yearYoungest' ? -1 : 1);
    }
    if (sortBy === 'dateNewest' || sortBy === 'dateOldest') {
      const createdA = getCreatedTimestamp(a);
      const createdB = getCreatedTimestamp(b);
      return compareDates(createdA, createdB, sortBy === 'dateNewest' ? -1 : 1);
    }

    return 0;
  });

  return list;
};

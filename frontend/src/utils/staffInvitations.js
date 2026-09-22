export function getHeadInviteState(role, profiles) {
  const hasActiveHead =
    Array.isArray(profiles) &&
    profiles.some(
      (profile) => profile?.role === "head" && profile.is_active === true,
    );

  return {
    hasActiveHead,
    disabled: role === "head" && hasActiveHead,
  };
}

export async function logoutToPublicHome(navigate, logout) {
  navigate('/', { replace: true });
  await logout();
}

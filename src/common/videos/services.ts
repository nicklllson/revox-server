export const getYouTubeId = (url: string) => {
  const { searchParams } = new URL(url);
  return searchParams.get('v');
};

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const getCategories = async () => {
  try {
    const response = await fetch(`${API_URL}/categories`);
    if (!response.ok) {
      throw new Error(`Failed to fetch categories: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to load categories:", error);
    throw error;
  }
};

export const getCategoryBySlug = async (slug) => {
  try {
    const response = await fetch(`${API_URL}/categories/${slug}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch category ${slug}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to load category ${slug}:`, error);
    throw error;
  }
};

export const getSongs = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    if (params.category) queryParams.append('category', params.category);
    if (params.search) queryParams.append('search', params.search);
    if (params.artist) queryParams.append('artist', params.artist);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = `${API_URL}/songs${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch songs: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to load songs:", error);
    throw error;
  }
};

export const getSongPlaybackInfo = async (id) => {
  try {
    const response = await fetch(`${API_URL}/songs/${id}/playback`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message || "Playback information unavailable"
      );
    }

    return data;
  } catch (error) {
    console.error(`Failed to load playback info for ${id}:`, error);
    throw error;
  }
};


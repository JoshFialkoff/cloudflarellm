import axios from 'axios'

const WORDPRESS_API_URL = 'https://aiassistliving.com/wp-json/wp/v2'

export async function getPages() {
  try {
    const response = await axios.get(`${WORDPRESS_API_URL}/pages?status=publish`)
    return response.data
  } catch (error) {
    console.error('Error fetching pages:', error)
    return []
  }
}

export async function getPageBySlug(slug) {
  try {
    const response = await axios.get(`${WORDPRESS_API_URL}/pages?slug=${slug}`)
    return response.data[0] || null
  } catch (error) {
    console.error(`Error fetching page ${slug}:`, error)
    return null
  }
}

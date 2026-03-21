import { useQuery } from "@apollo/client";
import { gql } from "@apollo/client";

const GET_ABOUT_US_PAGE = gql`
  query GetAboutUsPage {
    pageBy(uri: "about-us") {
      title
      content
    }
  }
`;

export default function AboutUs() {
  const { loading, error, data } = useQuery(GET_ABOUT_US_PAGE);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <h1>{data.pageBy.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: data.pageBy.content }} />
    </div>
  );
}

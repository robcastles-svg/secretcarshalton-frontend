export const metadata = { title: "Directory" };

export default function DirectoryPage() {
  return (
    <main className="container">
      <h1>Directory</h1>
      <p>
        The business directory isn&apos;t available here yet — it&apos;s powered by a
        WordPress plugin that doesn&apos;t expose its listings through the REST API this
        site reads from. In the meantime, browse the full directory on the WordPress site
        itself:{" "}
        <a href="https://www.secretcarshalton.com/directory/">secretcarshalton.com/directory</a>.
      </p>
    </main>
  );
}

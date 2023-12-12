document.querySelectorAll("a").forEach((link) => {
  const dataHref = link.getAttribute("data-href");
  if (dataHref) link.href = dataHref;
});

document.querySelectorAll("iframe").forEach((frame) => {
  const dataSrc = frame.getAttribute("data-src");
  if (dataSrc) frame.src = dataSrc;
});

if (origin !== "http://localhost:3000") {
  const app1 = origin.replace("3000", "3001");
  console.log("replace origin: " + app1);

  document.querySelectorAll("a").forEach((link) => {
    link.href = link.href.replace("http://localhost:3001", app1);
  });

  document.querySelectorAll("iframe").forEach((frame) => {
    frame.src = frame.src.replace("http://localhost:3001", app1);
  });
}

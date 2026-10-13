/**
 * The reviews visitors left on the old site's guestbook (Site Reviews
 * plugin, March 2023), kept as a static snapshot for /reviews — the
 * guestbook form itself closed when reviews moved to Google.
 */
export interface GuestbookReview {
  title: string;
  author: string;
  /** YYYY-MM-DD */
  date: string;
  rating: number;
  text: string[];
}

export const GUESTBOOK_REVIEWS: GuestbookReview[] = [
  {
    title: "My home!",
    author: "Val Newman",
    date: "2023-03-15",
    rating: 5,
    text: ["This site epitomizes Carshalton. It is such a lovely place and so well represented by this site. I simply love it and wish I could move back there….one day, one day."],
  },
  {
    title: "Interesting and informative",
    author: "Kenneth Willis",
    date: "2023-03-15",
    rating: 5,
    text: ["I spent my earliest years in Carshalton Beeches and often returned there to visit my grandparents as I grew older. I love ‘Secret Carshalton.’ Although I only see their tweets, usually, I always find them very interesting and informative and I love the photos."],
  },
  {
    title: "Passionate about our local area",
    author: "Bruce Glithero",
    date: "2023-03-15",
    rating: 5,
    text: ["Lots of wonderful pictures and great historical information about our local area. The postings on social media are always interesting to read and lead to a lot of people conversing about memories."],
  },
  {
    title: "Secret Carshalton",
    author: "Roger Thistle",
    date: "2023-03-15",
    rating: 5,
    text: ["As a Sutton resident for over forty years, a previous Carshalton councillor and a Deputy Mayor, I have a keen interest in the local area, and I’m very grateful for the research and pictures you publish. It’s important to keep each new generation aware of the history of Carshalton, which still has an abundance of special buildings and parks. Keep up the good work."],
  },
  {
    title: "Really enjoy this site",
    author: "Abbie Spires",
    date: "2023-03-15",
    rating: 5,
    text: ["It is terrific that there is a site which seeks out and honours all the best of our super village. I have lived in Carshalton for 20 years and Secret Carshalton keeps revealing new surprises for me."],
  },
  {
    title: "Fascinating insights!",
    author: "Clare Prior",
    date: "2023-03-14",
    rating: 5,
    text: ["Love being made aware of the broad range of stories, activities, histories, the buildings, streets and memories that pop up on these pages. A real treasure!"],
  },
  {
    title: "Love Secret Carshalton site",
    author: "Ann",
    date: "2023-03-14",
    rating: 5,
    text: ["Really interesting and engaging insights into local places, often with an unusual slant. Thank you! Love it!"],
  },
  {
    title: "Great local knowledge and promoter",
    author: "Ann",
    date: "2023-03-14",
    rating: 5,
    text: ["Really interesting and unusual insights into local history and places. Very interactive and engaging. Love it!"],
  },
  {
    title: "I love Secret Carshalton",
    author: "Diana",
    date: "2023-03-14",
    rating: 5,
    text: ["I absolutely love following Secret Carshalton. I especially enjoy historic facts and photos about Carshalton. I also love seeing photos from around Carshalton and local walks. Great job and keep it going!"],
  },
  {
    title: "Secret Carshalton",
    author: "Charlotte Norman",
    date: "2023-03-14",
    rating: 5,
    text: ["A very interesting and informative little group. It has some fascinating information about Carshalton. I love the photos."],
  },
  {
    title: "Superb Secret Carshalton",
    author: "Penny",
    date: "2023-03-14",
    rating: 5,
    text: ["Really look forward to Secret Carshalton’s posts. Beautiful photos of our local area and fabulously, interesting nuggets of information to boot. Lived here for ages but love learning more about the place. Keep up the great work 😁."],
  },
  {
    title: "The place we live",
    author: "Gerald Young",
    date: "2023-03-14",
    rating: 5,
    text: ["It’s amazing the things you learn and see about the Secret Carshalton we pass every day and take for granted or don’t see as we rush along in our busy lives.", "So thank you Secret Carshalton for pointing out the obvious beauty of Carshalton."],
  },
  {
    title: "Love Secret Carshalton",
    author: "Emma",
    date: "2023-03-14",
    rating: 5,
    text: ["I moved to the area 2 years ago, and I’ve enjoyed the website as well as the Facebook and instagram accounts, to find out more about the local area, and neighbouring places too."],
  },
  {
    title: "Love reading about Carshalton!",
    author: "Amy",
    date: "2023-03-14",
    rating: 5,
    text: ["A fantastic resource for information about all the hidden gems of Carshalton! I’ve learned so many new things and have recommended the site to my friends who are also in the area. Well done, look forward to continuing to follow along!"],
  },
  {
    title: "Loving the secrets of Carshalton",
    author: "Carol",
    date: "2023-03-14",
    rating: 5,
    text: ["Just love reading all about the Secrets of Carshalton- having lived here for 57 years. Thank you for all you do."],
  },
  {
    title: "A new page to leave your feedback",
    author: "Secret Carshalton",
    date: "2023-03-14",
    rating: 5,
    text: ["It’s really good to hear what you think about Secret Carshalton across social media and online. Do you enjoy it? What should we do differently? etc. Thanks for your ongoing support."],
  },
];

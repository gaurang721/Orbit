/**
 * Prisma seed — rich, idempotent demo data for local development.
 * Run with:  npm run prisma:seed
 * Re-seed fresh demo content with:  SEED_RESET=1 npm run prisma:seed
 *
 * Default password for every seeded user: "Password123"
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password123';

// ----- helpers ---------------------------------------------------------------
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
const sample = <T>(arr: T[], n: number): T[] => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000);
const hoursAgo = (h: number) => minsAgo(h * 60);
const daysAhead = (d: number) => new Date(Date.now() + d * 86_400_000);
const avatar = (i: number) => `https://i.pravatar.cc/300?img=${i}`;
const photo = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;
const REACTIONS = ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const;

async function main() {
  console.log('🌱 Seeding database…');
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);

  // ----- Users (idempotent upsert) -----
  const people = [
    { firstName: 'Super', lastName: 'Admin', username: 'superadmin', email: 'admin@fbclone.local', role: Role.SUPER_ADMIN, img: 12, bio: 'Keeping fbclone running.', location: 'San Francisco, CA' },
    { firstName: 'Ada', lastName: 'Lovelace', username: 'ada', email: 'ada@fbclone.local', role: Role.USER, img: 5, bio: 'Mathematician & first programmer.', location: 'London, UK' },
    { firstName: 'Alan', lastName: 'Turing', username: 'alan', email: 'alan@fbclone.local', role: Role.USER, img: 13, bio: 'Computers, codes & long runs.', location: 'Manchester, UK' },
    { firstName: 'Grace', lastName: 'Hopper', username: 'grace', email: 'grace@fbclone.local', role: Role.MODERATOR, img: 9, bio: 'Compiler pioneer. Debugging literal bugs.', location: 'New York, NY' },
    { firstName: 'Linus', lastName: 'Torvalds', username: 'linus', email: 'linus@fbclone.local', role: Role.USER, img: 33, bio: 'I made a little OS.', location: 'Portland, OR' },
    { firstName: 'Margaret', lastName: 'Hamilton', username: 'margaret', email: 'margaret@fbclone.local', role: Role.USER, img: 20, bio: 'Software engineering, moon edition.', location: 'Boston, MA' },
    { firstName: 'Katherine', lastName: 'Johnson', username: 'katherine', email: 'katherine@fbclone.local', role: Role.USER, img: 25, bio: 'Numbers take you places. 🚀', location: 'Hampton, VA' },
    { firstName: 'Dennis', lastName: 'Ritchie', username: 'dennis', email: 'dennis@fbclone.local', role: Role.USER, img: 51, bio: 'C you around.', location: 'Murray Hill, NJ' },
    { firstName: 'Tim', lastName: 'Berners-Lee', username: 'tim', email: 'tim@fbclone.local', role: Role.USER, img: 60, bio: 'This is for everyone.', location: 'Geneva, CH' },
    { firstName: 'Hedy', lastName: 'Lamarr', username: 'hedy', email: 'hedy@fbclone.local', role: Role.USER, img: 31, bio: 'Inventor & actress. Frequency hopping FTW.', location: 'Vienna, AT' },
    { firstName: 'Steve', lastName: 'Wozniak', username: 'woz', email: 'woz@fbclone.local', role: Role.USER, img: 52, bio: 'Engineer at heart.', location: 'Los Gatos, CA' },
    { firstName: 'Radia', lastName: 'Perlman', username: 'radia', email: 'radia@fbclone.local', role: Role.USER, img: 45, bio: 'Mother of the spanning tree.', location: 'Seattle, WA' },
  ];

  const users = [];
  for (const p of people) {
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: { profilePicture: avatar(p.img), coverPhoto: photo(`cover-${p.username}`), bio: p.bio, location: p.location },
      create: {
        firstName: p.firstName, lastName: p.lastName, username: p.username, email: p.email, password,
        role: p.role, emailVerified: true, verified: p.role !== Role.USER,
        profilePicture: avatar(p.img), coverPhoto: photo(`cover-${p.username}`), bio: p.bio, location: p.location,
        isOnline: Math.random() > 0.5, lastSeenAt: minsAgo(Math.floor(Math.random() * 600)),
      },
    });
    users.push(u);
  }
  const byUser = Object.fromEntries(users.map((u) => [u.username, u]));
  console.log(`  • ${users.length} users`);

  // ----- Marketplace categories (idempotent) -----
  const categories = [
    { name: 'Electronics', slug: 'electronics' },
    { name: 'Vehicles', slug: 'vehicles' },
    { name: 'Home & Garden', slug: 'home-garden' },
    { name: 'Clothing', slug: 'clothing' },
    { name: 'Toys & Games', slug: 'toys-games' },
  ];
  const cats = [];
  for (const c of categories) cats.push(await prisma.productCategory.upsert({ where: { slug: c.slug }, update: {}, create: c }));

  await prisma.systemSetting.upsert({
    where: { key: 'registration' }, update: {},
    create: { key: 'registration', value: { open: true, requireEmailVerification: false } },
  });

  // ----- Heavy demo content: run once, or force with SEED_RESET=1 -----
  const marker = await prisma.systemSetting.findUnique({ where: { key: 'demoSeeded' } });
  const reset = process.env.SEED_RESET === '1';
  if (marker && !reset) {
    console.log('  • demo content already seeded (use SEED_RESET=1 to regenerate). ✅');
    console.log(`✅ Seed complete. Log in with any seeded email + "${DEMO_PASSWORD}".`);
    return;
  }
  if (reset) {
    console.log('  • SEED_RESET=1 → clearing existing content…');
    await prisma.$transaction([
      prisma.notification.deleteMany({}),
      prisma.story.deleteMany({}),
      prisma.conversation.deleteMany({}),
      prisma.post.deleteMany({}),
      prisma.product.deleteMany({}),
      prisma.event.deleteMany({}),
      prisma.group.deleteMany({}),
      prisma.page.deleteMany({}),
      prisma.friendship.deleteMany({}),
      prisma.follow.deleteMany({}),
    ]);
  }

  const others = users.filter((u) => u.username !== 'superadmin');

  // ----- Friendships (a connected web) + follows -----
  let friendCount = 0;
  for (let i = 0; i < others.length; i++) {
    for (const friend of sample(others.filter((_, j) => j > i), 3)) {
      await prisma.friendship.upsert({
        where: { requesterId_addresseeId: { requesterId: others[i]!.id, addresseeId: friend.id } },
        update: {},
        create: { requesterId: others[i]!.id, addresseeId: friend.id, status: 'ACCEPTED', acceptedAt: hoursAgo(48) },
      }).then(() => friendCount++).catch(() => {});
    }
  }
  // a couple of pending requests TO ada so the Friends page has content
  for (const u of sample(others.filter((u) => u.username !== 'ada'), 2)) {
    await prisma.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId: u.id, addresseeId: byUser.ada!.id } },
      update: { status: 'PENDING' },
      create: { requesterId: u.id, addresseeId: byUser.ada!.id, status: 'PENDING' },
    }).catch(() => {});
  }
  // follows
  for (const u of others) for (const f of sample(others.filter((o) => o.id !== u.id), 4)) {
    await prisma.follow.upsert({ where: { followerId_followingId: { followerId: u.id, followingId: f.id } }, update: {}, create: { followerId: u.id, followingId: f.id } }).catch(() => {});
  }
  console.log(`  • friendships + follows`);

  // ----- Posts (text / background / image) with reactions & comments -----
  const textPosts = [
    'Just shipped a new feature 🚀 feeling great about it!',
    'Coffee + code = perfect morning ☕️',
    'Anyone else excited about the weekend? 😎',
    'TIL something amazing about distributed systems today.',
    'Throwback to the conference last month. Great memories!',
    'Reading a fantastic book on algorithms. Highly recommend 📚',
    'Beautiful sunset today 🌅',
    'Grateful for this amazing community ❤️',
    'New personal best on my morning run! 🏃',
    'Working on something exciting. Stay tuned…',
  ];
  const bgColors = ['#1877F2', '#E9710F', '#21A35E', '#9333EA', '#DB2777'];
  const comments = ['Love this! ❤️', 'So true 👏', 'Congrats!! 🎉', 'Amazing 😍', 'Thanks for sharing', 'Incredible work', 'This made my day', 'Couldn\'t agree more'];

  const posts = [];
  for (let i = 0; i < 28; i++) {
    const author = pick(others);
    const kind = Math.random();
    const createdAt = minsAgo(Math.floor(Math.random() * 60 * 24 * 4)); // up to 4 days
    const base = { authorId: author.id, status: 'PUBLISHED' as const, privacy: 'PUBLIC' as const, createdAt, publishedAt: createdAt };
    let post;
    if (kind < 0.45) {
      post = await prisma.post.create({ data: { ...base, type: 'IMAGE', content: pick(textPosts), media: { create: [{ type: 'IMAGE', url: photo(`post-${i}`), position: 0, uploaderId: author.id }] } } });
    } else if (kind < 0.7) {
      post = await prisma.post.create({ data: { ...base, type: 'BACKGROUND', content: pick(textPosts), backgroundColor: pick(bgColors) } });
    } else {
      post = await prisma.post.create({ data: { ...base, type: 'TEXT', content: pick(textPosts) } });
    }
    posts.push(post);

    // reactions
    const reactors = sample(others.filter((u) => u.id !== author.id), Math.floor(Math.random() * 7));
    for (const r of reactors) {
      await prisma.reaction.create({ data: { userId: r.id, postId: post.id, type: pick(REACTIONS as unknown as string[]) as never } }).catch(() => {});
    }
    // comments
    const commenters = sample(others, Math.floor(Math.random() * 4));
    for (const c of commenters) {
      await prisma.comment.create({ data: { postId: post.id, authorId: c.id, content: pick(comments), createdAt: new Date(createdAt.getTime() + 60000) } }).catch(() => {});
    }
    await prisma.post.update({ where: { id: post.id }, data: { reactionCount: reactors.length, commentCount: commenters.length } });
  }
  console.log(`  • ${posts.length} posts (with reactions + comments)`);

  // ----- Stories (active 24h) -----
  for (let i = 0; i < 6; i++) {
    const author = pick(others);
    const isText = Math.random() < 0.4;
    await prisma.story.create({
      data: {
        authorId: author.id,
        type: isText ? 'TEXT' : 'IMAGE',
        mediaUrl: isText ? null : photo(`story-${i}`),
        caption: isText ? pick(['Good vibes ✨', 'On the road 🚗', 'Hello world 👋', 'Best day ever!']) : pick(['📍 weekend trip', '☀️ summer', null as unknown as string]),
        backgroundColor: isText ? pick(bgColors) : null,
        createdAt: hoursAgo(Math.floor(Math.random() * 12)),
        expiresAt: new Date(Date.now() + (24 - Math.floor(Math.random() * 12)) * 3_600_000),
      },
    });
  }
  console.log('  • 6 stories');

  // ----- Groups -----
  const groupDefs = [
    { name: 'React Developers', privacy: 'PUBLIC' as const, description: 'Everything React, Next.js and the modern web.' },
    { name: 'Indie Hackers', privacy: 'PUBLIC' as const, description: 'Build, ship, and grow your own products.' },
    { name: 'Trail Runners', privacy: 'PUBLIC' as const, description: 'For people who love running off-road.' },
    { name: 'Book Club', privacy: 'PRIVATE' as const, description: 'Monthly reads & discussions.' },
    { name: 'Home Cooking', privacy: 'PUBLIC' as const, description: 'Share recipes and food pics 🍳' },
  ];
  for (let i = 0; i < groupDefs.length; i++) {
    const g = groupDefs[i]!;
    const creator = pick(others);
    const members = sample(others.filter((u) => u.id !== creator.id), 4 + Math.floor(Math.random() * 4));
    await prisma.group.create({
      data: {
        name: g.name, slug: `${g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`, description: g.description, privacy: g.privacy,
        createdById: creator.id, coverPhoto: photo(`group-${i}`), memberCount: members.length + 1,
        members: { create: [{ userId: creator.id, role: 'ADMIN' }, ...members.map((m) => ({ userId: m.id, role: 'MEMBER' as const }))] },
      },
    });
  }
  console.log(`  • ${groupDefs.length} groups`);

  // ----- Pages -----
  const pageDefs = [
    { name: 'TechCrunch', category: 'Media/News', type: 'BUSINESS' as const },
    { name: 'Joe\'s Coffee', category: 'Cafe', type: 'BUSINESS' as const },
    { name: 'The Daily Dev', category: 'Community', type: 'COMMUNITY' as const },
    { name: 'GreenThumb Gardening', category: 'Home & Garden', type: 'BRAND' as const },
    { name: 'Ada Lovelace Fans', category: 'Public Figure', type: 'FAN' as const },
  ];
  for (let i = 0; i < pageDefs.length; i++) {
    const p = pageDefs[i]!;
    const owner = pick(others);
    const followers = sample(users.filter((u) => u.id !== owner.id), 3 + Math.floor(Math.random() * 6));
    await prisma.page.create({
      data: {
        name: p.name, slug: `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`, category: p.category, type: p.type,
        about: `Welcome to the official ${p.name} page.`, ownerId: owner.id, coverPhoto: photo(`page-${i}`),
        verified: i < 2, followerCount: followers.length,
        followers: { create: followers.map((f) => ({ userId: f.id })) },
      },
    });
  }
  console.log(`  • ${pageDefs.length} pages`);

  // ----- Marketplace products -----
  const productDefs = [
    { title: 'iPhone 13 Pro - 256GB', price: 549, cat: 'electronics', cond: 'LIKE_NEW' },
    { title: 'Mountain Bike (Trek)', price: 420, cat: 'vehicles', cond: 'GOOD' },
    { title: 'Mid-century Sofa', price: 300, cat: 'home-garden', cond: 'USED' },
    { title: 'Leather Jacket - M', price: 85, cat: 'clothing', cond: 'GOOD' },
    { title: 'LEGO Star Wars Set', price: 60, cat: 'toys-games', cond: 'NEW' },
    { title: 'MacBook Air M2', price: 899, cat: 'electronics', cond: 'LIKE_NEW' },
    { title: 'Standing Desk', price: 180, cat: 'home-garden', cond: 'GOOD' },
    { title: 'Acoustic Guitar', price: 130, cat: 'toys-games', cond: 'USED' },
  ];
  for (let i = 0; i < productDefs.length; i++) {
    const d = productDefs[i]!;
    const seller = pick(others);
    const category = cats.find((c) => c.slug === d.cat);
    await prisma.product.create({
      data: {
        sellerId: seller.id, title: d.title, description: `${d.title} in ${d.cond.replace('_', ' ').toLowerCase()} condition. Message me for details!`,
        price: d.price, currency: 'USD', condition: d.cond as never, status: 'AVAILABLE',
        location: seller.location, categoryId: category?.id,
        images: { create: [{ type: 'IMAGE', url: photo(`product-${i}`), position: 0, uploaderId: seller.id }] },
      },
    });
  }
  console.log(`  • ${productDefs.length} marketplace listings`);

  // ----- Events -----
  const eventDefs = [
    { title: 'React Meetup #42', days: 3, location: 'Online' },
    { title: 'Weekend Trail Run', days: 5, location: 'Forest Park' },
    { title: 'Indie Hackers Demo Night', days: 7, location: 'WeWork Downtown' },
    { title: 'Book Club: Sci-Fi Month', days: 10, location: 'Central Library' },
    { title: 'Cooking Workshop: Pasta', days: 14, location: 'Community Kitchen' },
  ];
  for (let i = 0; i < eventDefs.length; i++) {
    const e = eventDefs[i]!;
    const organizer = pick(others);
    const going = sample(users.filter((u) => u.id !== organizer.id), 3 + Math.floor(Math.random() * 5));
    const interested = sample(users.filter((u) => u.id !== organizer.id && !going.includes(u)), 2 + Math.floor(Math.random() * 3));
    await prisma.event.create({
      data: {
        organizerId: organizer.id, title: e.title, description: `Join us for ${e.title}!`, location: e.location, startAt: daysAhead(e.days),
        coverPhoto: photo(`event-${i}`), goingCount: going.length + 1, interestedCount: interested.length,
        attendees: { create: [{ userId: organizer.id, status: 'GOING' }, ...going.map((g) => ({ userId: g.id, status: 'GOING' as const })), ...interested.map((g) => ({ userId: g.id, status: 'INTERESTED' as const }))] },
      },
    });
  }
  console.log(`  • ${eventDefs.length} events`);

  // ----- Conversations + messages -----
  const chatPairs = [[byUser.ada, byUser.alan], [byUser.ada, byUser.grace], [byUser.alan, byUser.linus]];
  const chatLines = ['Hey! How are you?', 'Doing great, you?', 'Want to grab coffee this week?', 'Sure, Thursday works!', 'Perfect, see you then ☕️', 'Sounds good 👍'];
  for (const [a, b] of chatPairs) {
    if (!a || !b) continue;
    const conv = await prisma.conversation.create({ data: { isGroup: false, createdById: a.id, members: { create: [{ userId: a.id }, { userId: b.id }] } } });
    let last = hoursAgo(5);
    for (let i = 0; i < chatLines.length; i++) {
      last = new Date(last.getTime() + 5 * 60000);
      await prisma.message.create({ data: { conversationId: conv.id, senderId: i % 2 === 0 ? a.id : b.id, content: chatLines[i]!, type: 'TEXT', createdAt: last } });
    }
    await prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: last } });
  }
  console.log(`  • ${chatPairs.length} conversations`);

  // ----- A few notifications for ada -----
  for (const u of sample(others.filter((u) => u.username !== 'ada'), 3)) {
    await prisma.notification.create({ data: { recipientId: byUser.ada!.id, actorId: u.id, type: 'FOLLOW', message: 'started following you', link: `/u/${u.username}`, createdAt: hoursAgo(Math.floor(Math.random() * 20)) } });
  }

  await prisma.systemSetting.upsert({ where: { key: 'demoSeeded' }, update: { value: { at: new Date().toISOString() } }, create: { key: 'demoSeeded', value: { at: new Date().toISOString() } } });
  console.log(`✅ Seed complete. Log in with any seeded email + "${DEMO_PASSWORD}" (e.g. ada@fbclone.local).`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

// minigames.js — Soul Safety Mini-Games: Pong, Rock Paper Scissors, Lucky Word

const MINIGAME_API = window.API || '';

// Auth header helper — reads token from app.js
function miniAuthHeaders(extra = {}) {
  const h = { ...extra };
  if (window.authToken) h['Authorization'] = `Bearer ${window.authToken}`;
  return h;
}

// ===== LUCKY WORD LIST (365 curated words) =====
const WORD_LIST = [
  { word: 'Petrichor', pos: 'noun', pron: '/ˈpɛtrɪkɔːr/', def: 'The pleasant, earthy smell produced when rain falls on dry soil.', ex: 'After weeks of drought, the petrichor was intoxicating.' },
  { word: 'Serendipity', pos: 'noun', pron: '/ˌsɛrənˈdɪpɪti/', def: 'The occurrence of events by chance in a happy or beneficial way.', ex: 'Finding that bookshop was pure serendipity.' },
  { word: 'Ephemeral', pos: 'adjective', pron: '/ɪˈfɛmərəl/', def: 'Lasting for a very short time.', ex: 'The ephemeral beauty of cherry blossoms makes them more precious.' },
  { word: 'Sonder', pos: 'noun', pron: '/ˈsɒndər/', def: 'The realization that each passerby has a life as vivid and complex as your own.', ex: 'Sitting in the cafe, she felt a deep sonder watching the crowd.' },
  { word: 'Vellichor', pos: 'noun', pron: '/ˈvɛlɪkɔːr/', def: 'The strange wistfulness of used bookstores.', ex: 'The vellichor of the old shop made her linger for hours.' },
  { word: 'Hiraeth', pos: 'noun', pron: '/ˈhɪraɪ̯θ/', def: 'A deep longing for something, especially one\'s home.', ex: 'Living abroad filled him with hiraeth for the green valleys.' },
  { word: 'Eudaimonia', pos: 'noun', pron: '/juːdaɪˈmoʊniə/', def: 'A state of happiness and well-being; human flourishing.', ex: 'The pursuit of eudaimonia requires living with purpose.' },
  { word: 'Komorebi', pos: 'noun', pron: '/koˈmoɾebi/', def: 'Sunlight filtering through the leaves of trees.', ex: 'They sat on the forest floor, bathed in komorebi.' },
  { word: 'Saudade', pos: 'noun', pron: '/saʊˈdadʒi/', def: 'A melancholic longing for something or someone loved and lost.', ex: 'The old song filled her with saudade for her grandmother.' },
  { word: 'Ubuntu', pos: 'noun', pron: '/ʊˈbʊntuː/', def: 'The belief in a universal bond of sharing that connects all humanity.', ex: 'Ubuntu teaches us that we exist through our connections to others.' },
  { word: 'Fernweh', pos: 'noun', pron: '/ˈfɛʁnveː/', def: 'An ache for distant places; the craving for travel.', ex: 'Looking at the atlas gave her an unbearable fernweh.' },
  { word: 'Meraki', pos: 'noun', pron: '/meˈrɑːki/', def: 'Doing something with soul, creativity, or love; putting yourself into your work.', ex: 'She painted with meraki, every brushstroke deliberate and heartfelt.' },
  { word: 'Natsukashii', pos: 'adjective', pron: '/natsɯkashiː/', def: 'A nostalgic longing for the past, with happiness for the fond memory.', ex: 'The taste of that candy was wonderfully natsukashii.' },
  { word: 'Querencia', pos: 'noun', pron: '/keˈɾensja/', def: 'A place from which one\'s strength is drawn; where one feels at home.', ex: 'The garden became her querencia, a refuge from the world.' },
  { word: 'Yugen', pos: 'noun', pron: '/juːˈɡɛn/', def: 'A profound awareness of the universe that triggers emotional responses too deep for words.', ex: 'Standing before the ocean at dusk, she felt yugen.' },
  { word: 'Chrysalism', pos: 'noun', pron: '/ˈkrɪsəlɪzəm/', def: 'The amniotic tranquility of being indoors during a thunderstorm.', ex: 'Wrapped in blankets, she surrendered to the chrysalism of the storm.' },
  { word: 'Phosphenes', pos: 'noun', pron: '/ˈfɒsfiːnz/', def: 'The light and colors produced by rubbing your eyes.', ex: 'He pressed his palms to his tired eyes, watching the phosphenes dance.' },
  { word: 'Sofrosyne', pos: 'noun', pron: '/soˈfroːsyneː/', def: 'A deep awareness of true self, resulting in a harmony of the soul.', ex: 'Through meditation, she found sofrosyne.' },
  { word: 'Halcyon', pos: 'adjective', pron: '/ˈhælsiən/', def: 'Denoting a period of time that was idyllically happy and peaceful.', ex: 'Those halcyon summer days would never be forgotten.' },
  { word: 'Apricity', pos: 'noun', pron: '/əˈprɪsɪti/', def: 'The warmth of the sun in winter.', ex: 'She turned her face to the sky, savoring the rare apricity of February.' },
  { word: 'Mellifluous', pos: 'adjective', pron: '/mɛˈlɪfluəs/', def: 'Sweet-sounding; pleasant to hear.', ex: 'Her mellifluous voice made even bad news sound gentle.' },
  { word: 'Ineffable', pos: 'adjective', pron: '/ɪnˈɛfəbəl/', def: 'Too great or extreme to be expressed or described in words.', ex: 'The beauty of the northern lights was truly ineffable.' },
  { word: 'Luminescence', pos: 'noun', pron: '/luːmɪˈnɛsəns/', def: 'Light produced by chemical, electrical, or physiological means.', ex: 'The ocean\'s bioluminescence turned the waves into liquid starlight.' },
  { word: 'Reverie', pos: 'noun', pron: '/ˈrɛvəri/', def: 'A state of being pleasantly lost in one\'s thoughts; a daydream.', ex: 'She sat by the window in a gentle reverie.' },
  { word: 'Ethereal', pos: 'adjective', pron: '/ɪˈθɪəriəl/', def: 'Extremely delicate and light in a way that seems not of this world.', ex: 'The morning mist gave the landscape an ethereal quality.' },
  { word: 'Solitude', pos: 'noun', pron: '/ˈsɒlɪtjuːd/', def: 'The state of being alone, especially when this is peaceful and pleasant.', ex: 'She craved the solitude of early morning walks.' },
  { word: 'Syzygy', pos: 'noun', pron: '/ˈsɪzɪdʒi/', def: 'An alignment of three celestial bodies.', ex: 'The rare syzygy produced a spectacular eclipse.' },
  { word: 'Dulcet', pos: 'adjective', pron: '/ˈdʌlsɪt/', def: 'Sweet and soothing, especially of sound.', ex: 'The dulcet tones of the guitar lulled everyone to peace.' },
  { word: 'Elysian', pos: 'adjective', pron: '/ɪˈlɪziən/', def: 'Relating to or characteristic of paradise; blissful.', ex: 'The hidden garden was an Elysian retreat.' },
  { word: 'Iridescent', pos: 'adjective', pron: '/ˌɪrɪˈdɛsənt/', def: 'Showing luminous colors that seem to change when seen from different angles.', ex: 'The soap bubble was perfectly iridescent.' },
  { word: 'Limerence', pos: 'noun', pron: '/ˈlɪmərəns/', def: 'The state of being infatuated or obsessed with another person.', ex: 'His limerence made every text from her feel like a gift.' },
  { word: 'Numinous', pos: 'adjective', pron: '/ˈnjuːmɪnəs/', def: 'Having a strong spiritual quality; indicating the presence of the divine.', ex: 'The ancient temple had a numinous atmosphere.' },
  { word: 'Resplendent', pos: 'adjective', pron: '/rɪˈsplɛndənt/', def: 'Attractive and impressive through being richly colorful or sumptuous.', ex: 'The autumn forest was resplendent in gold and crimson.' },
  { word: 'Susurrus', pos: 'noun', pron: '/suˈsʌrəs/', def: 'A whispering or rustling sound.', ex: 'The susurrus of wind through the wheat field was hypnotic.' },
  { word: 'Wanderlust', pos: 'noun', pron: '/ˈwɒndəlʌst/', def: 'A strong desire to travel and explore the world.', ex: 'Her wanderlust took her to thirty countries before thirty.' },
  { word: 'Catharsis', pos: 'noun', pron: '/kəˈθɑːrsɪs/', def: 'The process of releasing strong or repressed emotions.', ex: 'Writing in her journal was a daily catharsis.' },
  { word: 'Incandescent', pos: 'adjective', pron: '/ˌɪnkænˈdɛsənt/', def: 'Emitting light as a result of being heated; full of strong emotion.', ex: 'Her incandescent joy was contagious.' },
  { word: 'Gossamer', pos: 'adjective', pron: '/ˈɡɒsəmər/', def: 'Used to refer to something very light, thin, and insubstantial.', ex: 'The gossamer wings of the dragonfly caught the light.' },
  { word: 'Symbiosis', pos: 'noun', pron: '/ˌsɪmbaɪˈoʊsɪs/', def: 'A mutually beneficial relationship between different entities.', ex: 'Their friendship was a beautiful symbiosis of creativity and logic.' },
  { word: 'Verdant', pos: 'adjective', pron: '/ˈvɜːrdənt/', def: 'Green with grass or other rich vegetation.', ex: 'The verdant hillside glistened after the spring rain.' },
  { word: 'Scintilla', pos: 'noun', pron: '/sɪnˈtɪlə/', def: 'A tiny trace or spark of a specified quality or feeling.', ex: 'There was not a scintilla of doubt in her mind.' },
  { word: 'Redamancy', pos: 'noun', pron: '/rɪˈdæmənsi/', def: 'The act of loving the one who loves you; a love returned in full.', ex: 'Their relationship was the purest form of redamancy.' },
  { word: 'Pluviophile', pos: 'noun', pron: '/ˈpluːviəfaɪl/', def: 'A person who finds joy and peace of mind during rainy days.', ex: 'As a lifelong pluviophile, she kept her window open during storms.' },
  { word: 'Ailurophile', pos: 'noun', pron: '/aɪˈlʊərəˌfaɪl/', def: 'A person who loves cats.', ex: 'The devoted ailurophile had adopted her fifth rescue kitten.' },
  { word: 'Clinomania', pos: 'noun', pron: '/ˌklaɪnoʊˈmeɪniə/', def: 'An excessive desire to stay in bed.', ex: 'Sunday mornings brought on her clinomania in full force.' },
  { word: 'Kalon', pos: 'noun', pron: '/kəˈlɒn/', def: 'Beauty that is more than skin deep.', ex: 'Her kindness and warmth embodied true kalon.' },
  { word: 'Trouvaille', pos: 'noun', pron: '/truːˈvaɪ/', def: 'A lucky find; a valuable discovery.', ex: 'The antique map was a trouvaille at the flea market.' },
  { word: 'Eunoia', pos: 'noun', pron: '/juːˈnɔɪ.ə/', def: 'Beautiful thinking; a well mind.', ex: 'She practiced eunoia by choosing thoughts that served her growth.' },
  { word: 'Cwtch', pos: 'noun', pron: '/kʊtʃ/', def: 'A Welsh word meaning a warm, affectionate cuddle or hug.', ex: 'After the long day, all she wanted was a good cwtch.' },
  { word: 'Nepenthe', pos: 'noun', pron: '/nɪˈpɛnθi/', def: 'Something that makes you forget grief or suffering.', ex: 'Music was her nepenthe during difficult times.' },
  { word: 'Ataraxia', pos: 'noun', pron: '/ˌætəˈræksiə/', def: 'A state of serene calmness; freedom from mental disturbance.', ex: 'Through years of practice, she achieved a steady ataraxia.' },
  { word: 'Nemophilist', pos: 'noun', pron: '/nɪˈmɒfɪlɪst/', def: 'One who is fond of forests; a haunter of the woods.', ex: 'The nemophilist spent every weekend among the ancient oaks.' },
  { word: 'Tacenda', pos: 'noun', pron: '/tæˈsɛndə/', def: 'Things better left unsaid; matters to be passed over in silence.', ex: 'Some truths are tacenda, held gently in the heart alone.' },
  { word: 'Vorfreude', pos: 'noun', pron: '/ˈfoːɐ̯ˌfrɔʏ̯də/', def: 'The joyful, intense anticipation that comes from imagining future pleasures.', ex: 'The vorfreude of the upcoming trip kept her awake with excitement.' },
  { word: 'Selcouth', pos: 'adjective', pron: '/ˈsɛlkuːθ/', def: 'Unfamiliar, rare, strange, and yet marvelous.', ex: 'The deep-sea creature was beautifully selcouth.' },
  { word: 'Orenda', pos: 'noun', pron: '/oˈrɛndə/', def: 'A mystical force present in all people that empowers them to change the world.', ex: 'She believed in the orenda within her to make a difference.' },
  { word: 'Metanoia', pos: 'noun', pron: '/ˌmɛtəˈnɔɪə/', def: 'The journey of changing one\'s mind, heart, self, or way of life.', ex: 'His year of travel was a profound metanoia.' },
  { word: 'Liminality', pos: 'noun', pron: '/ˌlɪmɪˈnæləti/', def: 'The quality of ambiguity that occurs in the middle stage of a transition.', ex: 'Graduation brought a bittersweet liminality between student and adult life.' },
  { word: 'Ikigai', pos: 'noun', pron: '/ˌiːkiˈɡaɪ/', def: 'A Japanese concept meaning a reason for being; the thing that gets you up in the morning.', ex: 'Teaching children became her ikigai.' },
  { word: 'Hygge', pos: 'noun', pron: '/ˈhʊɡə/', def: 'A quality of coziness and comfortable conviviality that engenders a feeling of well-being.', ex: 'Candles, blankets, and hot cocoa — pure hygge.' },
  { word: 'Toska', pos: 'noun', pron: '/ˈtɔskə/', def: 'A Russian word for a deep spiritual anguish without a specific cause.', ex: 'On grey winter afternoons, she felt the weight of toska.' },
  { word: 'Gigil', pos: 'noun', pron: '/ˈɡiːɡɪl/', def: 'The irresistible urge to pinch or squeeze something that is unbearably cute.', ex: 'The puppy\'s little face gave everyone intense gigil.' },
  { word: 'Lagom', pos: 'noun', pron: '/ˈlɑːɡɒm/', def: 'A Swedish word meaning just the right amount; not too much, not too little.', ex: 'Her approach to life was perfectly lagom.' },
  { word: 'Wabi-sabi', pos: 'noun', pron: '/ˈwɑːbi ˈsɑːbi/', def: 'Finding beauty in imperfection and accepting the natural cycle of growth and decay.', ex: 'The cracked pottery embodied wabi-sabi.' },
  { word: 'Tsundoku', pos: 'noun', pron: '/ˈtsʊndɒkuː/', def: 'The act of acquiring books and letting them pile up without reading them.', ex: 'Her tsundoku habit had filled every shelf in the house.' },
  { word: 'Waldeinsamkeit', pos: 'noun', pron: '/ˈvaldˌʔaɪ̯nzaːmkaɪ̯t/', def: 'The feeling of solitude and connectedness to nature when being alone in the woods.', ex: 'Deep in the forest, he found perfect waldeinsamkeit.' },
  { word: 'Kintsukuroi', pos: 'noun', pron: '/kɪnˈtsuːkɪrɔɪ/', def: 'The art of repairing broken pottery with gold, understanding that the piece is more beautiful for having been broken.', ex: 'Like kintsukuroi, her scars made her story richer.' },
  { word: 'Sobremesa', pos: 'noun', pron: '/soˌbreˈmesa/', def: 'The time spent talking at the table after a meal is finished.', ex: 'The best conversations happened during the sobremesa.' },
  { word: 'Flaneur', pos: 'noun', pron: '/flɑːˈnɜːr/', def: 'A person who walks the city in order to experience it.', ex: 'He was a devoted flaneur, knowing every hidden alley of Paris.' },
  { word: 'Gökotta', pos: 'noun', pron: '/jøːˈkɔtːa/', def: 'To wake up early in the morning with the purpose of going outside to hear the first birds sing.', ex: 'She set her alarm for gökotta on the first day of spring.' },
  { word: 'Cosagach', pos: 'adjective', pron: '/ˈkɒsəɡæx/', def: 'A Scottish Gaelic word meaning snug, sheltered, and warm.', ex: 'The little cabin was perfectly cosagach in the winter storm.' },
  { word: 'Flâneuse', pos: 'noun', pron: '/flɑːˈnɜːz/', def: 'A woman who wanders the streets observing life with artistic intent.', ex: 'She was the consummate flâneuse, notebook always in hand.' },
  { word: 'Uitwaaien', pos: 'verb', pron: '/ˈœytˌʋaːjən/', def: 'To take a refreshing walk in the wind to clear one\'s mind.', ex: 'After the stressful week, she went to the beach to uitwaaien.' },
  { word: 'Eleutheromania', pos: 'noun', pron: '/ɪˌluːθəroʊˈmeɪniə/', def: 'An intense and irresistible desire for freedom.', ex: 'Her eleutheromania led her to quit her job and travel the world.' },
  { word: 'Psithurism', pos: 'noun', pron: '/ˈsɪθjʊrɪzəm/', def: 'The sound of wind whispering through the trees.', ex: 'The gentle psithurism was the only sound in the meadow.' },
  { word: 'Basorexia', pos: 'noun', pron: '/ˌbeɪsɔːˈrɛksiə/', def: 'An overwhelming desire to kiss.', ex: 'Under the moonlight, basorexia took hold of them both.' },
  { word: 'Novaturient', pos: 'adjective', pron: '/ˌnoʊvəˈtjʊəriənt/', def: 'Desiring or seeking powerful change in one\'s life or situation.', ex: 'She felt novaturient, ready to rebuild everything from scratch.' },
  { word: 'Raconteur', pos: 'noun', pron: '/ˌrækɒnˈtɜːr/', def: 'A person who tells anecdotes in a skillful and amusing way.', ex: 'Grandpa was the family raconteur, holding everyone spellbound.' },
  { word: 'Alexithymia', pos: 'noun', pron: '/əˌlɛksɪˈθaɪmiə/', def: 'The inability to recognize or describe one\'s own emotions.', ex: 'His alexithymia made relationships challenging, but not impossible.' },
  { word: 'Thalassophile', pos: 'noun', pron: '/θəˈlæsəfaɪl/', def: 'A person who loves the sea or ocean.', ex: 'A lifelong thalassophile, she chose to live by the coast.' },
  { word: 'Cafuné', pos: 'noun', pron: '/kɑːfuˈneɪ/', def: 'The act of tenderly running one\'s fingers through someone\'s hair.', ex: 'She fell asleep to the gentle cafuné of her partner.' },
  { word: 'Phenology', pos: 'noun', pron: '/fɪˈnɒlədʒi/', def: 'The study of how seasons and climate affect nature\'s timetable.', ex: 'Phenology helps us predict when the first flowers will bloom.' },
  { word: 'Sillage', pos: 'noun', pron: '/siˈjɑːʒ/', def: 'The scent that lingers in the air after someone walks by.', ex: 'Her sillage of jasmine made people turn their heads.' },
  { word: 'Mudita', pos: 'noun', pron: '/muˈdiːtɑː/', def: 'The pleasure that comes from delighting in other people\'s well-being.', ex: 'She felt pure mudita at her friend\'s success.' },
  { word: 'Orithyia', pos: 'noun', pron: '/ˌɒrɪˈθaɪə/', def: 'The force of a wild wind that stirs the spirit.', ex: 'The orithyia of the autumn gale filled her with restless energy.' },
  { word: 'Opia', pos: 'noun', pron: '/ˈoʊpiə/', def: 'The ambiguous intensity of looking someone in the eye.', ex: 'The opia between strangers on the train was electric.' },
  { word: 'Morii', pos: 'noun', pron: '/ˈmɔːriː/', def: 'The desire to capture a fleeting experience.', ex: 'She felt morii watching the sunset, wishing she could bottle the moment.' },
  { word: 'Kenopsia', pos: 'noun', pron: '/kɪˈnɒpsiə/', def: 'The eerie atmosphere of a place that is usually bustling with people but is now abandoned.', ex: 'The empty school hallways had an unsettling kenopsia.' },
  { word: 'Altschmerz', pos: 'noun', pron: '/ˈɑːltʃmɛrts/', def: 'Weariness with the same old issues; tiredness of dealing with repeated problems.', ex: 'The altschmerz of daily commuting was wearing him down.' },
  { word: 'Occhiolism', pos: 'noun', pron: '/ˈɒkioʊlɪzəm/', def: 'The awareness of the smallness of your perspective.', ex: 'Astronomy class gave him a profound sense of occhiolism.' },
  { word: 'Jouska', pos: 'noun', pron: '/ˈʒuːskə/', def: 'A hypothetical conversation that you compulsively play out in your head.', ex: 'She spent the drive rehearsing jouska with her boss.' },
  { word: 'Rubatosis', pos: 'noun', pron: '/ruːbəˈtoʊsɪs/', def: 'The unsettling awareness of your own heartbeat.', ex: 'Lying in bed, rubatosis kept her awake.' },
  { word: 'Liberosis', pos: 'noun', pron: '/ˌlɪbəˈroʊsɪs/', def: 'The desire to care less about things.', ex: 'Overwhelmed by deadlines, she craved liberosis.' },
  { word: 'Enouement', pos: 'noun', pron: '/ˈɛnuːmənt/', def: 'The bittersweet feeling of having arrived in the future and not being able to tell your past self.', ex: 'Looking at old photos filled her with enouement.' },
  { word: 'Vellichor', pos: 'noun', pron: '/ˈvɛlɪkɔːr/', def: 'The strange wistfulness of used bookstores.', ex: 'Every corner of the old shop was thick with vellichor.' },
  { word: 'Adronitis', pos: 'noun', pron: '/ˌædrəˈnaɪtɪs/', def: 'Frustration with how long it takes to get to know someone.', ex: 'Their first date was tinged with adronitis — they wanted to skip to deep friendship.' },
  { word: 'Floruit', pos: 'noun', pron: '/ˈflɔːruɪt/', def: 'The period during which a person, school, or movement was most active or flourishing.', ex: 'The floruit of that artistic movement lasted barely a decade.' },
  { word: 'Aphelion', pos: 'noun', pron: '/əˈfiːliən/', def: 'The point in orbit farthest from the sun; being at one\'s greatest distance from something.', ex: 'During her aphelion from the city, she discovered rural peace.' },
  { word: 'Penumbra', pos: 'noun', pron: '/pɪˈnʌmbrə/', def: 'The partial shadow outside the complete shadow of an eclipse.', ex: 'They stood in the penumbra, watching the last sliver of sun.' },
  { word: 'Sonorous', pos: 'adjective', pron: '/ˈsɒnərəs/', def: 'Producing a deep, resonant sound.', ex: 'The sonorous bell echoed across the valley.' },
  { word: 'Diaphanous', pos: 'adjective', pron: '/daɪˈæfənəs/', def: 'Light, delicate, and translucent.', ex: 'The diaphanous curtains drifted in the morning breeze.' },
  { word: 'Epiphany', pos: 'noun', pron: '/ɪˈpɪfəni/', def: 'A moment of sudden and great revelation or realization.', ex: 'Her epiphany came while watching the rain — she knew what to do.' },
  { word: 'Ebullience', pos: 'noun', pron: '/ɪˈbʊliəns/', def: 'The quality of being cheerful and full of energy; exuberance.', ex: 'His natural ebullience made every gathering brighter.' },
  { word: 'Cerulean', pos: 'adjective', pron: '/sɪˈruːliən/', def: 'Deep sky blue.', ex: 'The cerulean waters of the lagoon were impossibly clear.' },
  { word: 'Zenith', pos: 'noun', pron: '/ˈzɛnɪθ/', def: 'The highest point reached by a celestial body; the peak.', ex: 'At the zenith of her career, she felt strangely calm.' },
  { word: 'Cascade', pos: 'noun', pron: '/kæˈskeɪd/', def: 'A small waterfall, or a series of stages in a process.', ex: 'A cascade of wildflowers tumbled down the hillside.' },
  { word: 'Phosphorescence', pos: 'noun', pron: '/ˌfɒsfəˈrɛsəns/', def: 'Light emitted without heat or combustion.', ex: 'The phosphorescence of the midnight waves was otherworldly.' },
  { word: 'Seraglio', pos: 'noun', pron: '/sɪˈrælioʊ/', def: 'A place of seclusion or luxury.', ex: 'The rooftop garden was her personal seraglio above the city.' },
  { word: 'Meliorism', pos: 'noun', pron: '/ˈmiːliərɪzəm/', def: 'The belief that the world can be made better by human effort.', ex: 'Her meliorism fueled years of volunteer work.' },
  { word: 'Palimpsest', pos: 'noun', pron: '/ˈpælɪmpsɛst/', def: 'Something bearing visible traces of an earlier form.', ex: 'The old city was a palimpsest of every era that built it.' },
  { word: 'Crepuscular', pos: 'adjective', pron: '/krɪˈpʌskjʊlər/', def: 'Of, resembling, or relating to twilight.', ex: 'The crepuscular light made the landscape feel dreamlike.' },
  { word: 'Quintessence', pos: 'noun', pron: '/kwɪnˈtɛsəns/', def: 'The most perfect or typical example of a quality or class.', ex: 'This meal is the quintessence of comfort food.' },
  { word: 'Efflorescence', pos: 'noun', pron: '/ˌɛflɔːˈrɛsəns/', def: 'The state of flowering or blooming.', ex: 'Spring brought the garden\'s annual efflorescence.' },
  { word: 'Peripatetic', pos: 'adjective', pron: '/ˌpɛrɪpəˈtɛtɪk/', def: 'Traveling from place to place.', ex: 'Her peripatetic lifestyle suited her restless spirit.' },
  { word: 'Opalescent', pos: 'adjective', pron: '/ˌoʊpəˈlɛsənt/', def: 'Showing many small points of shifting color against a pale background.', ex: 'The opalescent shell caught the light like a tiny galaxy.' },
  { word: 'Lethologica', pos: 'noun', pron: '/ˌlɛθəˈlɒdʒɪkə/', def: 'The inability to remember a particular word or name.', ex: 'Lethologica struck at the worst moment — mid-presentation.' },
  { word: 'Selcouth', pos: 'adjective', pron: '/ˈsɛlkuːθ/', def: 'Unfamiliar, rare, strange, and yet marvelous.', ex: 'The aurora was a selcouth sight in those southern latitudes.' },
  { word: 'Umbra', pos: 'noun', pron: '/ˈʌmbrə/', def: 'The fully shaded inner region of a shadow; a phantom.', ex: 'They stood in the umbra of the ancient cathedral.' },
  { word: 'Callithump', pos: 'noun', pron: '/ˈkælɪθʌmp/', def: 'A noisy, boisterous parade or celebration.', ex: 'The neighborhood callithump rang in the new year with pots and pans.' },
  { word: 'Susquehanna', pos: 'noun', pron: '/ˌsʌskwɪˈhænə/', def: 'A word said to be the most beautiful in the English language.', ex: 'The Susquehanna River winds through valleys of extraordinary beauty.' },
  { word: 'Fernweh', pos: 'noun', pron: '/ˈfɛʁnveː/', def: 'An ache for distant places; the craving for travel.', ex: 'The atlas on her desk was proof of her chronic fernweh.' },
  { word: 'Benevolence', pos: 'noun', pron: '/bəˈnɛvələns/', def: 'The quality of being well-meaning; kindness.', ex: 'Her quiet benevolence touched everyone she met.' },
  { word: 'Scintillate', pos: 'verb', pron: '/ˈsɪntɪleɪt/', def: 'To emit flashes of light; to sparkle.', ex: 'Stars scintillate more when the air is turbulent.' },
  { word: 'Archipelago', pos: 'noun', pron: '/ˌɑːrkɪˈpɛləɡoʊ/', def: 'A group of islands scattered across water.', ex: 'They sailed through the emerald archipelago for a week.' },
  { word: 'Soliloquy', pos: 'noun', pron: '/səˈlɪləkwi/', def: 'An act of speaking one\'s thoughts aloud when alone.', ex: 'Her morning soliloquy helped organize the day ahead.' },
  { word: 'Labyrinthine', pos: 'adjective', pron: '/ˌlæbɪˈrɪnθaɪn/', def: 'Like a labyrinth; irregular and twisting.', ex: 'The old town\'s labyrinthine streets delighted every explorer.' },
  { word: 'Cosmopolitan', pos: 'adjective', pron: '/ˌkɒzməˈpɒlɪtən/', def: 'Familiar with and at ease in many different countries and cultures.', ex: 'Her cosmopolitan upbringing gave her a broad worldview.' },
  { word: 'Serenity', pos: 'noun', pron: '/sɪˈrɛnɪti/', def: 'The state of being calm, peaceful, and untroubled.', ex: 'The lake at dawn was a picture of serenity.' },
  { word: 'Bioluminescence', pos: 'noun', pron: '/ˌbaɪoʊluːmɪˈnɛsəns/', def: 'The production of light by living organisms.', ex: 'Swimming through bioluminescence felt like flying through stars.' },
  { word: 'Amaranthine', pos: 'adjective', pron: '/ˌæməˈrænθaɪn/', def: 'Immortal; undying; deep reddish-purple.', ex: 'Their amaranthine love defied every obstacle.' },
  { word: 'Veridical', pos: 'adjective', pron: '/vəˈrɪdɪkəl/', def: 'Truthful; corresponding to facts.', ex: 'Her veridical account left no room for doubt.' },
  { word: 'Dulcimer', pos: 'noun', pron: '/ˈdʌlsɪmər/', def: 'A musical instrument with strings stretched over a trapezoidal sounding board.', ex: 'The dulcimer\'s twang echoed through the mountain hollow.' },
  { word: 'Ephemeron', pos: 'noun', pron: '/ɪˈfɛmərɒn/', def: 'Something short-lived or transitory.', ex: 'Each snowflake is a perfect ephemeron.' },
  { word: 'Melisma', pos: 'noun', pron: '/mɪˈlɪzmə/', def: 'A group of notes sung to one syllable of text.', ex: 'The singer\'s melisma on the final note gave everyone chills.' },
  { word: 'Synchronicity', pos: 'noun', pron: '/ˌsɪŋkrəˈnɪsɪti/', def: 'The simultaneous occurrence of events that appear meaningfully related but have no discernible causal connection.', ex: 'They both ordered the same rare book on the same day — pure synchronicity.' },
  { word: 'Eloquence', pos: 'noun', pron: '/ˈɛləkwəns/', def: 'Fluent or persuasive speaking or writing.', ex: 'Her eloquence turned a simple speech into something unforgettable.' },
  { word: 'Paraselene', pos: 'noun', pron: '/ˌpærəsɪˈliːni/', def: 'A bright spot in the sky appearing on either side of the moon, caused by refraction of moonlight.', ex: 'The paraselene made the winter night feel magical.' },
];

// ===== WORD OF THE DAY =====
function getWordOfTheDay() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  // Seeded random from date string
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = ((seed << 5) - seed) + dateStr.charCodeAt(i);
    seed = seed & seed;
  }
  const index = Math.abs(seed) % WORD_LIST.length;
  return { ...WORD_LIST[index], date: dateStr };
}

// ===== GAME MODAL =====
function openMiniGame(challengeId, game) {
  const modal = document.getElementById('gameModal');
  const content = document.getElementById('gameModalContent');
  if (!modal || !content) return;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  switch (game) {
    case 'pong': renderPongGame(content, challengeId); break;
    case 'rps': renderRPSGame(content, challengeId); break;
    case 'word': renderWordGame(content, challengeId); break;
    default: content.innerHTML = '<p>Unknown game</p>';
  }
}
window.openMiniGame = openMiniGame;

function closeGameModal() {
  const modal = document.getElementById('gameModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}
window.closeGameModal = closeGameModal;

// ===== PONG (Turn-Based Reflex Game) =====
function renderPongGame(container, challengeId) {
  const cUser = window.currentUser || 'raphael';
  container.innerHTML = `
    <div class="minigame-header">
      <h2>🏓 Pong Volley</h2>
      <button class="minigame-close" onclick="closeGameModal()">✕</button>
    </div>
    <div class="pong-game" id="pongGame">
      <div class="pong-score-bar">
        <div class="pong-player-score">
          <span>You</span>
          <span class="pong-score" id="pongYourScore">0</span>
        </div>
        <div class="pong-round" id="pongRound">Round 1 / 5</div>
        <div class="pong-player-score">
          <span>Opponent</span>
          <span class="pong-score" id="pongTheirScore">0</span>
        </div>
      </div>
      <canvas id="pongCanvas" width="360" height="480"></canvas>
      <div class="pong-zones" id="pongZones">
        <button class="pong-zone" data-zone="left" onclick="pongBlock('left')">◀</button>
        <button class="pong-zone" data-zone="center" onclick="pongBlock('center')">■</button>
        <button class="pong-zone" data-zone="right" onclick="pongBlock('right')">▶</button>
      </div>
      <div class="pong-status" id="pongStatus">Tap a zone to block the ball!</div>
    </div>
  `;

  initPongRound(challengeId);
}

let pongState = { round: 1, yourScore: 0, theirScore: 0, ballTarget: null, locked: false, challengeId: null };

function initPongRound(challengeId) {
  pongState.challengeId = challengeId || pongState.challengeId;
  pongState.locked = false;
  pongState.ballTarget = ['left', 'center', 'right'][Math.floor(Math.random() * 3)];

  const canvas = document.getElementById('pongCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // Animate ball coming toward player
  let ballY = 0;
  let ballX = pongState.ballTarget === 'left' ? w * 0.2 : pongState.ballTarget === 'right' ? w * 0.8 : w * 0.5;
  const targetY = h - 60;

  // Add slight randomness to make it harder to predict early
  const wobble = (Math.random() - 0.5) * 40;
  let revealed = false;

  function drawFrame() {
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#1a3a3a';
    ctx.fillRect(0, 0, w, h);

    // Net line
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Ball
    const progress = ballY / targetY;
    const currentX = progress < 0.6 ? w / 2 + wobble * progress : ballX + (w / 2 - ballX + wobble * 0.6) * (1 - (progress - 0.6) / 0.4) * -1 + w / 2;
    const realX = progress < 0.6 ? w / 2 + wobble * progress : ballX;

    ctx.beginPath();
    ctx.arc(progress < 0.6 ? currentX : realX, ballY, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#c2623a';
    ctx.fill();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#c2623a';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Paddle area hint
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, h - 70, w / 3, 70);
    ctx.fillRect(w / 3, h - 70, w / 3, 70);
    ctx.fillRect(2 * w / 3, h - 70, w / 3, 70);

    if (ballY < targetY && !pongState.locked) {
      ballY += 4;
      requestAnimationFrame(drawFrame);
    } else if (!pongState.locked) {
      // Time's up — auto miss
      pongState.locked = true;
      pongResolve(null);
    }
  }

  requestAnimationFrame(drawFrame);
  document.getElementById('pongStatus').textContent = 'Watch the ball and block it!';
  document.getElementById('pongRound').textContent = `Round ${pongState.round} / 5`;
}

function pongBlock(zone) {
  if (pongState.locked) return;
  pongState.locked = true;
  pongResolve(zone);
}
window.pongBlock = pongBlock;

function pongResolve(zone) {
  const blocked = zone === pongState.ballTarget;
  const statusEl = document.getElementById('pongStatus');

  if (blocked) {
    pongState.yourScore++;
    document.getElementById('pongYourScore').textContent = pongState.yourScore;
    statusEl.textContent = '🛡️ Blocked! Nice reflexes!';
    statusEl.style.color = '#6b8f71';
  } else {
    pongState.theirScore++;
    document.getElementById('pongTheirScore').textContent = pongState.theirScore;
    statusEl.textContent = zone ? `❌ Missed! Ball was ${pongState.ballTarget}` : '⏰ Too slow!';
    statusEl.style.color = '#c2623a';
  }

  // Save move
  if (pongState.challengeId) {
    fetch(`${MINIGAME_API}/api/challenge/${pongState.challengeId}/move`, {
      method: 'POST',
      headers: miniAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ player: window.currentUser, move_data: { zone, target: pongState.ballTarget, blocked }, round: pongState.round })
    }).catch(() => {});
  }

  pongState.round++;
  if (pongState.round <= 5) {
    setTimeout(() => {
      statusEl.style.color = '';
      initPongRound();
    }, 1200);
  } else {
    setTimeout(() => {
      const result = pongState.yourScore > pongState.theirScore ? 'You win!' : pongState.yourScore < pongState.theirScore ? 'They win!' : 'It\'s a tie!';
      statusEl.textContent = `🏆 Game Over! ${pongState.yourScore} - ${pongState.theirScore}. ${result}`;
      statusEl.style.color = '#d4a24e';
      pongState = { round: 1, yourScore: 0, theirScore: 0, ballTarget: null, locked: false, challengeId: null };
    }, 1000);
  }
}

// ===== ROCK PAPER SCISSORS =====
function renderRPSGame(container, challengeId) {
  container.innerHTML = `
    <div class="minigame-header">
      <h2>✊ Rock Paper Scissors</h2>
      <button class="minigame-close" onclick="closeGameModal()">✕</button>
    </div>
    <div class="rps-game" id="rpsGame">
      <div class="rps-round-info" id="rpsRoundInfo">Best of 3 — Round 1</div>
      <div class="rps-arena">
        <div class="rps-hand rps-hand-opponent" id="rpsOpponentHand">
          <div class="rps-hand-emoji">✊</div>
          <div class="rps-hand-label">Opponent</div>
        </div>
        <div class="rps-vs">VS</div>
        <div class="rps-hand rps-hand-you" id="rpsYourHand">
          <div class="rps-hand-emoji">✊</div>
          <div class="rps-hand-label">You</div>
        </div>
      </div>
      <div class="rps-timer" id="rpsTimer">
        <div class="rps-timer-bar" id="rpsTimerBar"></div>
        <span id="rpsTimerText">10s</span>
      </div>
      <div class="rps-choices" id="rpsChoices">
        <button class="rps-choice" onclick="rpsChoose('rock')">
          <span class="rps-choice-emoji">🪨</span>
          <span>Rock</span>
        </button>
        <button class="rps-choice" onclick="rpsChoose('paper')">
          <span class="rps-choice-emoji">📄</span>
          <span>Paper</span>
        </button>
        <button class="rps-choice" onclick="rpsChoose('scissors')">
          <span class="rps-choice-emoji">✂️</span>
          <span>Scissors</span>
        </button>
      </div>
      <div class="rps-result" id="rpsResult"></div>
      <div class="rps-score-bar">
        <span>You: <strong id="rpsYourScore">0</strong></span>
        <span>Them: <strong id="rpsTheirScore">0</strong></span>
      </div>
    </div>
  `;

  rpsState = { round: 1, yourScore: 0, theirScore: 0, timer: null, timeLeft: 10, challengeId, chosen: false };
  startRPSTimer();
}

let rpsState = {};

function startRPSTimer() {
  rpsState.timeLeft = 10;
  rpsState.chosen = false;
  const timerBar = document.getElementById('rpsTimerBar');
  const timerText = document.getElementById('rpsTimerText');
  const choices = document.getElementById('rpsChoices');
  if (choices) choices.style.pointerEvents = '';

  rpsState.timer = setInterval(() => {
    rpsState.timeLeft--;
    if (timerText) timerText.textContent = `${rpsState.timeLeft}s`;
    if (timerBar) timerBar.style.width = `${(rpsState.timeLeft / 10) * 100}%`;

    if (rpsState.timeLeft <= 0) {
      clearInterval(rpsState.timer);
      if (!rpsState.chosen) {
        // Random pick for timeout
        const moves = ['rock', 'paper', 'scissors'];
        rpsChoose(moves[Math.floor(Math.random() * 3)], true);
      }
    }
  }, 1000);
}

function rpsChoose(choice, wasTimeout = false) {
  if (rpsState.chosen) return;
  rpsState.chosen = true;
  clearInterval(rpsState.timer);

  const choices = document.getElementById('rpsChoices');
  if (choices) choices.style.pointerEvents = 'none';

  // Simulate opponent pick
  const moves = ['rock', 'paper', 'scissors'];
  const opponentChoice = moves[Math.floor(Math.random() * 3)];

  const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
  const yourHandEl = document.querySelector('#rpsYourHand .rps-hand-emoji');
  const oppHandEl = document.querySelector('#rpsOpponentHand .rps-hand-emoji');

  // Animate shake
  yourHandEl.parentElement.classList.add('rps-shaking');
  oppHandEl.parentElement.classList.add('rps-shaking');

  setTimeout(() => {
    yourHandEl.parentElement.classList.remove('rps-shaking');
    oppHandEl.parentElement.classList.remove('rps-shaking');
    yourHandEl.textContent = emojis[choice];
    oppHandEl.textContent = emojis[opponentChoice];

    const result = rpsWinner(choice, opponentChoice);
    const resultEl = document.getElementById('rpsResult');

    if (result === 'win') {
      rpsState.yourScore++;
      resultEl.textContent = wasTimeout ? '⏰ Random pick — You win this round!' : '🎉 You win this round!';
      resultEl.className = 'rps-result rps-win';
    } else if (result === 'lose') {
      rpsState.theirScore++;
      resultEl.textContent = wasTimeout ? '⏰ Random pick — You lose this round!' : '😤 They win this round!';
      resultEl.className = 'rps-result rps-lose';
    } else {
      resultEl.textContent = "🤝 It's a tie!";
      resultEl.className = 'rps-result rps-tie';
    }

    document.getElementById('rpsYourScore').textContent = rpsState.yourScore;
    document.getElementById('rpsTheirScore').textContent = rpsState.theirScore;

    // Save move
    if (rpsState.challengeId) {
      fetch(`${MINIGAME_API}/api/challenge/${rpsState.challengeId}/move`, {
        method: 'POST',
        headers: miniAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ player: window.currentUser, move_data: { choice, opponent: opponentChoice, result }, round: rpsState.round })
      }).catch(() => {});
    }

    rpsState.round++;
    if (rpsState.yourScore < 2 && rpsState.theirScore < 2 && rpsState.round <= 5) {
      setTimeout(() => {
        document.getElementById('rpsRoundInfo').textContent = `Best of 3 — Round ${rpsState.round}`;
        resultEl.textContent = '';
        resultEl.className = 'rps-result';
        yourHandEl.textContent = '✊';
        oppHandEl.textContent = '✊';
        startRPSTimer();
      }, 1800);
    } else {
      setTimeout(() => {
        const final = rpsState.yourScore > rpsState.theirScore ? '🏆 You won the match!' : rpsState.yourScore < rpsState.theirScore ? '💔 They won the match!' : '🤝 Match tied!';
        resultEl.textContent = final;
        resultEl.className = 'rps-result rps-final';
        document.getElementById('rpsRoundInfo').textContent = 'Match Complete!';
      }, 1800);
    }
  }, 800);
}
window.rpsChoose = rpsChoose;

function rpsWinner(a, b) {
  if (a === b) return 'tie';
  if ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper')) return 'win';
  return 'lose';
}

// ===== LUCKY WORD OF THE DAY =====
function renderWordGame(container, challengeId) {
  const word = getWordOfTheDay();
  const cUser = window.currentUser || 'raphael';

  container.innerHTML = `
    <div class="minigame-header">
      <h2>📖 Lucky Word of the Day</h2>
      <button class="minigame-close" onclick="closeGameModal()">✕</button>
    </div>
    <div class="word-game" id="wordGame">
      <div class="word-card">
        <div class="word-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div class="word-main">${word.word}</div>
        <div class="word-pron">${word.pron}</div>
        <div class="word-pos">${word.pos}</div>
        <div class="word-def">${word.def}</div>
        <div class="word-example">"${word.ex}"</div>
      </div>
      <div class="word-reflections">
        <h3>Reflections</h3>
        <div class="word-reflection-cards" id="wordReflections">
          <div class="word-reflection-card raphael">
            <div class="word-reflection-header">
              <span class="word-reflection-avatar">🌻</span> Raphael
            </div>
            <div class="word-reflection-text" id="wordReflectionRaphael">
              ${cUser === 'raphael' ? `<textarea id="wordReflectInput" placeholder="What does this word mean to you?" maxlength="280"></textarea><button class="word-reflect-btn" onclick="submitWordReflection()">Share</button>` : '<em>No reflection yet</em>'}
            </div>
          </div>
          <div class="word-reflection-card taylor">
            <div class="word-reflection-header">
              <span class="word-reflection-avatar">🌿</span> Taylor
            </div>
            <div class="word-reflection-text" id="wordReflectionTaylor">
              ${cUser === 'taylor' ? `<textarea id="wordReflectInput" placeholder="What does this word mean to you?" maxlength="280"></textarea><button class="word-reflect-btn" onclick="submitWordReflection()">Share</button>` : '<em>No reflection yet</em>'}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Load existing reflections
  loadWordReflections(word.date);
}

async function loadWordReflections(date) {
  try {
    const res = await fetch(`${MINIGAME_API}/api/word-reflection?date=${date}`, { headers: miniAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const cUser = window.currentUser || 'raphael';

    ['raphael', 'taylor'].forEach(uid => {
      if (data[uid]) {
        const el = document.getElementById(uid === 'raphael' ? 'wordReflectionRaphael' : 'wordReflectionTaylor');
        if (el) {
          if (uid === cUser) {
            el.innerHTML = `<p class="word-shared-reflection">${escapeHTMLSafe(data[uid].text)}</p>`;
          } else {
            el.innerHTML = `<p class="word-shared-reflection">${escapeHTMLSafe(data[uid].text)}</p>`;
          }
        }
      }
    });
  } catch (e) {
    console.error('Failed to load reflections:', e);
  }
}

async function submitWordReflection() {
  const input = document.getElementById('wordReflectInput');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  const cUser = window.currentUser || 'raphael';
  const date = new Date().toISOString().split('T')[0];

  try {
    await fetch(`${MINIGAME_API}/api/word-reflection`, {
      method: 'POST',
      headers: miniAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ user_id: cUser, text, date })
    });

    const el = document.getElementById(cUser === 'raphael' ? 'wordReflectionRaphael' : 'wordReflectionTaylor');
    if (el) el.innerHTML = `<p class="word-shared-reflection">${escapeHTMLSafe(text)}</p>`;
    if (typeof showToast === 'function') showToast('Reflection shared!', 'success');
  } catch (e) {
    if (typeof showToast === 'function') showToast('Failed to share reflection', 'error');
  }
}
window.submitWordReflection = submitWordReflection;

function escapeHTMLSafe(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

import type {
    CommonPluginFilters,
    CommonPluginInfo,
    CommonUserData,
    EmptyObject,
    JsonObject,
    NonNullableProp,
} from "../../types/common";
import type { Exception, PlayerState } from "./Websocket";

/**
 * Load result types
 */
export const enum LoadType {
    /**
     * A track has been loaded
     */
    Track = "track",

    /**
     * A playlist has been loaded
     */
    Playlist = "playlist",

    /**
     * A search result has been loaded
     */
    Search = "search",

    /**
     * There has been no matches for your identifier
     */
    Empty = "empty",

    /**
     * Loading has failed with an error
     */
    Error = "error",
}

/**
 * Route planner types
 */
export const enum RoutePlannerType {
    /**
     * IP address used is switched on ban. Recommended for IPv4 blocks or IPv6 blocks smaller than a /64
     */
    Rotating = "RotatingIpRoutePlanner",

    /**
     * IP address used is switched on clock update. Use with at least 1 /64 IPv6 block
     */
    Nano = "NanoIpRoutePlanner",

    /**
     * IP address used is switched on clock update, rotates to a different /64 block on ban. Use with at least 2x /64 IPv6 blocks
     */
    RotatingNano = "RotatingNanoIpRoutePlanner",

    /**
     * IP address used is selected at random per request. Recommended for larger IP blocks
     */
    Balancing = "BalancingIpRoutePlanner",
}

/**
 * IP block types
 */
export const enum IPBlockType {
    /**
     * The ipv4 block type
     */
    V4 = "Inet4Address",

    /**
     * The ipv6 block type
     */
    V6 = "Inet6Address",
}

/**
 * REST error response
 */
export interface RestError {
    /**
     * The timestamp of the error in milliseconds since the Unix epoch
     */
    timestamp: number;

    /**
     * The HTTP status code
     */
    status: number;

    /**
     * The HTTP status code message
     */
    error: string;

    /**
     * The stack trace of the error when `trace=true` as query param has been sent
     */
    trace?: string;

    /**
     * The error message
     */
    message: string;

    /**
     * The request path
     */
    path: string;
}

/**
 * API track representation
 */
export interface APITrack<
    UserData extends JsonObject = CommonUserData,
    PluginInfo extends JsonObject = CommonPluginInfo,
> {
    /**
     * The base64 encoded track data
     */
    encoded: string;

    /**
     * Info about the track
     */
    info: TrackInfo;

    /**
     * Additional track info provided by plugins
     */
    pluginInfo: PluginInfo;

    /**
     * Additional track data provided via the Update Player endpoint
     */
    userData: UserData;
}

/**
 * Track information
 */
export interface TrackInfo {
    /**
     * The track identifier
     */
    identifier: string;

    /**
     * Whether the track is seekable
     */
    isSeekable: boolean;

    /**
     * The track author
     */
    author: string;

    /**
     * The track length in milliseconds
     */
    length: number;

    /**
     * Whether the track is a stream
     */
    isStream: boolean;

    /**
     * The track position in milliseconds
     */
    position: number;

    /**
     * The track title
     */
    title: string;

    /**
     * The track uri
     */
    uri: string | null;

    /**
     * The track artwork url
     */
    artworkUrl: string | null;

    /**
     * The track ISRC
     */
    isrc: string | null;

    /**
     * The track source name
     */
    sourceName: string;
}

/**
 * Playlist information
 */
export interface PlaylistInfo {
    /**
     * The name of the playlist
     */
    name: string;

    /**
     * The selected track of the playlist (`-1` if no track is selected)
     */
    selectedTrack: number;
}

/**
 * Track load result
 */
export interface TrackLoadResult {
    loadType: LoadType.Track;
    data: APITrack;
}

/**
 * API playlist representation
 */
export interface APIPlaylist<PluginInfo extends JsonObject = CommonPluginInfo> {
    /**
     * The info of the playlist
     */
    info: PlaylistInfo;

    /**
     * Addition playlist info provided by plugins
     */
    pluginInfo: PluginInfo;

    /**
     * The tracks of the playlist
     */
    tracks: APITrack[];
}

/**
 * Playlist load result
 */
export interface PlaylistLoadResult {
    loadType: LoadType.Playlist;
    data: APIPlaylist;
}

/**
 * Search load result
 */
export interface SearchLoadResult {
    loadType: LoadType.Search;
    data: APITrack[];
}

/**
 * Empty load result
 */
export interface EmptyLoadResult {
    loadType: LoadType.Empty;
    data: EmptyObject;
}

/**
 * Error load result
 */
export interface ErrorLoadResult {
    loadType: LoadType.Error;
    data: Exception;
}

/**
 * Load result union type
 */
export type LoadResult = TrackLoadResult | PlaylistLoadResult | SearchLoadResult | EmptyLoadResult | ErrorLoadResult;

/**
 * API player representation
 */
export interface APIPlayer {
    /**
     * The guild id of the player
     */
    guildId: string;

    /**
     * The currently playing track
     */
    track: APITrack | null;

    /**
     * The volume of the player, range 0-1000, in percentage
     */
    volume: number;

    /**
     * Whether the player is paused
     */
    paused: boolean;

    /**
     * The state of the player
     */
    state: PlayerState;

    /**
     * The voice state of the player
     */
    voice: APIVoiceState;

    /**
     * The filters used by the player
     */
    filters: Filters;
}

/**
 * API voice state
 */
export interface APIVoiceState {
    /**
     * The Discord voice token to authenticate with
     */
    token: string;

    /**
     * The Discord voice endpoint to connect to
     */
    endpoint: string;

    /**
     * The Discord voice session id to authenticate with
     */
    sessionId: string;

    /**
     * The Discord voice channel id the bot is connecting to
     */
    channelId: string | null;
}

/**
 * Audio filters
 */
export interface Filters<PluginFilters extends JsonObject = CommonPluginFilters> {
    /**
     * Adjusts the player volume from 0.0 to 5.0, where 1.0 is 100%. Values >1.0 may cause clipping
     */
    volume?: number;

    /**
     * Adjusts 15 different bands
     */
    equalizer?: EqualizerFilter;

    /**
     * Eliminates part of a band, usually targeting vocals
     */
    karaoke?: KaraokeFilter;

    /**
     * Changes the speed, pitch, and rate
     */
    timescale?: TimescaleFilter;

    /**
     * Creates a shuddering effect, where the volume quickly oscillates
     */
    tremolo?: TremoloFilter;

    /**
     * Creates a shuddering effect, where the pitch quickly oscillates
     */
    vibrato?: VibratoFilter;

    /**
     * Rotates the audio around the stereo channels/user headphones (aka Audio Panning)
     */
    rotation?: RotationFilter;

    /**
     * Distorts the audio
     */
    distortion?: DistortionFilter;

    /**
     * Mixes both channels (left and right)
     */
    channelMix?: ChannelMixFilter;

    /**
     * Filters higher frequencies
     */
    lowPass?: LowPassFilter;

    /**
     * Filter plugin configurations
     */
    pluginFilters?: PluginFilters;
}

/**
 * Equalizer band
 */
export interface EqualizerBand {
    /**
     * The band (0 to 14)
     */
    band: number;

    /**
     * The gain (-0.25 to 1.0)
     */
    gain: number;
}

/**
 * Equalizer filter (array of bands)
 */
export type EqualizerFilter = EqualizerBand[];

/**
 * Karaoke filter
 */
export interface KaraokeFilter {
    /**
     * The level (0 to 1.0 where 0.0 is no effect and 1.0 is full effect)
     */
    level?: number;

    /**
     * The mono level (0 to 1.0 where 0.0 is no effect and 1.0 is full effect)
     */
    monoLevel?: number;

    /**
     * The filter band (in Hz)
     */
    filterBand?: number;

    /**
     * The filter width
     */
    filterWidth?: number;
}

/**
 * Timescale filter
 */
export interface TimescaleFilter {
    /**
     * The playback speed 0.0 ≤ x
     */
    speed?: number;

    /**
     * The pitch 0.0 ≤ x
     */
    pitch?: number;

    /**
     * The rate 0.0 ≤ x
     */
    rate?: number;
}

/**
 * Tremolo filter
 */
export interface TremoloFilter {
    /**
     * The frequency 0.0 < x
     */
    frequency?: number;

    /**
     * The tremolo depth 0.0 < x ≤ 1.0
     */
    depth?: number;
}

/**
 * Vibrato filter
 */
export interface VibratoFilter {
    /**
     * The frequency 0.0 < x ≤ 14.0
     */
    frequency?: number;

    /**
     * The vibrato depth 0.0 < x ≤ 1.0
     */
    depth?: number;
}

/**
 * Rotation filter
 */
export interface RotationFilter {
    /**
     * The frequency of the audio rotating around the listener in Hz. 0.2 is similar to the example video above
     */
    rotationHz?: number;
}

/**
 * Distortion filter
 */
export interface DistortionFilter {
    /**
     * The sin offset
     */
    sinOffset?: number;

    /**
     * The sin scale
     */
    sinScale?: number;

    /**
     * The cos offset
     */
    cosOffset?: number;

    /**
     * The cos scale
     */
    cosScale?: number;

    /**
     * The tan offset
     */
    tanOffset?: number;

    /**
     * The tan scale
     */
    tanScale?: number;

    /**
     * The offset
     */
    offset?: number;

    /**
     * The scale
     */
    scale?: number;
}

/**
 * Channel mix filter
 */
export interface ChannelMixFilter {
    /**
     * The left to left channel mix factor (0.0 ≤ x ≤ 1.0)
     */
    leftToLeft?: number;

    /**
     * The left to right channel mix factor (0.0 ≤ x ≤ 1.0)
     */
    leftToRight?: number;

    /**
     * The right to left channel mix factor (0.0 ≤ x ≤ 1.0)
     */
    rightToLeft?: number;

    /**
     * The right to right channel mix factor (0.0 ≤ x ≤ 1.0)
     */
    rightToRight?: number;
}

/**
 * Low pass filter
 */
export interface LowPassFilter {
    /**
     * The smoothing factor (1.0 < x)
     */
    smoothing?: number;
}

/**
 * Player update query parameters
 */
export interface PlayerUpdateQueryParams {
    /**
     * Whether to replace the current track with the new track. Defaults to `false`
     */
    noReplace?: boolean;
}

/**
 * Player update request body
 */
export interface PlayerUpdateRequestBody {
    /**
     * Specification for a new track to load, as well as user data to set
     */
    track?: PlayerUpdateTrackData;

    /**
     * The track position in milliseconds
     */
    position?: number;

    /**
     * The track end time in milliseconds (must be > 0). `null` resets this if it was set previously
     */
    endTime?: number | null;

    /**
     * The player volume, in percentage, from 0 to 1000
     */
    volume?: number;

    /**
     * Whether the player is paused
     */
    paused?: boolean;

    /**
     * The new filters to apply. This will override all previously applied filters
     */
    filters?: Filters;

    /**
     * Information required for connecting to Discord
     */
    voice?: NonNullableProp<APIVoiceState, "channelId">;
}

/**
 * Player update track data
 */
export interface PlayerUpdateTrackData<UserData extends JsonObject = CommonUserData> {
    /**
     * The base64 encoded track to play. `null` stops the current track.
     * `encoded` and `identifier` are mutually exclusive.
     */
    encoded?: string | null;

    /**
     * The identifier of the track to play.
     * `encoded` and `identifier` are mutually exclusive.
     */
    identifier?: string;

    /**
     * Additional track data to be sent back in the Track Object
     */
    userData?: UserData;
}

/**
 * Session update request body
 */
export interface SessionUpdateRequestBody {
    /**
     * Whether resuming is enabled for this session or not
     */
    resuming?: boolean;

    /**
     * The timeout in seconds (default is 60s)
     */
    timeout?: number;
}

/**
 * Session update response body
 */
export type SessionUpdateResponseBody = Required<SessionUpdateRequestBody>;

/**
 * Lavalink info response
 */
export interface LavalinkInfo {
    /**
     * The version of this Lavalink server
     */
    version: LavalinkVersion;

    /**
     * The millisecond unix timestamp when this Lavalink jar was built
     */
    buildTime: number;

    /**
     * The git information of this Lavalink server
     */
    git: LavalinkGit;

    /**
     * The JVM version this Lavalink server runs on
     */
    jvm: string;

    /**
     * The Lavaplayer version being used by this server
     */
    lavaplayer: string;

    /**
     * The enabled source managers for this server
     */
    sourceManagers: string[];

    /**
     * The enabled filters for this server
     */
    filters: string[];

    /**
     * The enabled plugins for this server
     */
    plugins: LavalinkPlugin[];
}

/**
 * Lavalink version information
 */
export interface LavalinkVersion {
    /**
     * The full version string of this Lavalink server
     */
    semver: string;

    /**
     * The major version of this Lavalink server
     */
    major: number;

    /**
     * The minor version of this Lavalink server
     */
    minor: number;

    /**
     * The patch version of this Lavalink server
     */
    patch: number;

    /**
     * The pre-release version according to semver as a `.` separated list of identifiers
     */
    preRelease: string | null;

    /**
     * The build metadata according to semver as a `.` separated list of identifiers
     */
    build: string | null;
}

/**
 * Lavalink git information
 */
export interface LavalinkGit {
    /**
     * The branch this Lavalink server was built on
     */
    branch: string;

    /**
     * The commit this Lavalink server was built on
     */
    commit: string;

    /**
     * The millisecond unix timestamp for when the commit was created
     */
    commitTime: number;
}

/**
 * Lavalink plugin information
 */
export interface LavalinkPlugin {
    /**
     * The name of the plugin
     */
    name: string;

    /**
     * The version of the plugin
     */
    version: string;
}

/**
 * IP block information
 */
export interface IPBlock {
    /**
     * The type of the ip block
     */
    type: IPBlockType;

    /**
     * The size of the ip block
     */
    size: string;
}

/**
 * Failing address information
 */
export interface FailingAddress {
    /**
     * The failing address
     */
    failingAddress: string;

    /**
     * The timestamp when the address failed
     */
    failingTimestamp: number;

    /**
     * The timestamp when the address failed as a pretty string
     */
    failingTime: string;
}

/**
 * Base route planner details
 */
export interface BaseRoutePlannerDetails {
    /**
     * The ip block being used
     */
    ipBlock: IPBlock;

    /**
     * The failing addresses
     */
    failingAddresses: FailingAddress[];
}

/**
 * Rotating route planner details
 */
export interface RotatingRoutePlannerDetails extends BaseRoutePlannerDetails {
    /**
     * The number of rotations
     */
    rotateIndex: string;

    /**
     * The current offset in the block
     */
    ipIndex: string;

    /**
     * The current address being used
     */
    currentAddress: string;
}

/**
 * Nano route planner details
 */
export interface NanoRoutePlannerDetails extends BaseRoutePlannerDetails {
    /**
     * The current offset in the ip block
     */
    currentAddressIndex: string;
}

/**
 * Rotating nano route planner details
 */
export interface RotatingNanoRoutePlannerDetails extends BaseRoutePlannerDetails {
    /**
     * The current offset in the ip block
     */
    currentAddressIndex: string;

    /**
     * The information in which /64 block ips are chosen. This number increases on each ban.
     */
    blockIndex: string;
}

/**
 * Balancing route planner details
 */
export interface BalancingRoutePlannerDetails extends BaseRoutePlannerDetails {}

/**
 * Rotating route planner status
 */
export interface RotatingRoutePlannerStatus {
    class: RoutePlannerType.Rotating;
    details: RotatingRoutePlannerDetails;
}

/**
 * Nano route planner status
 */
export interface NanoRoutePlannerStatus {
    class: RoutePlannerType.Nano;
    details: NanoRoutePlannerDetails;
}

/**
 * Rotating nano route planner status
 */
export interface RotatingNanoRoutePlannerStatus {
    class: RoutePlannerType.RotatingNano;
    details: RotatingNanoRoutePlannerDetails;
}

/**
 * Balancing route planner status
 */
export interface BalancingRoutePlannerStatus {
    class: RoutePlannerType.Balancing;
    details: BalancingRoutePlannerDetails;
}

/**
 * Nullish route planner status
 */
export interface NullishRoutePlannerStatus {
    class: null;
    details: null;
}

/**
 * Route planner status union type
 */
export type RoutePlannerStatus =
    | RotatingRoutePlannerStatus
    | NanoRoutePlannerStatus
    | RotatingNanoRoutePlannerStatus
    | BalancingRoutePlannerStatus
    | NullishRoutePlannerStatus;

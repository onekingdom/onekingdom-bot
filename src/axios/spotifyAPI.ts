import axios from "axios";
import { supabase } from "../lib/supabase";
import { spotifyAPI } from "../classes/spotify";

export const SpotifyAPI = axios.create({
  baseURL: "https://api.spotify.com/v1",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    
  },
});

//spotify request interceptor
SpotifyAPI.interceptors.request.use(
  async (request) => {
    if (request.broadcasterID === undefined) {
      throw new Error("broadcasterID is missing");
    }

    const { data, error } = await supabase
      .from("spotify_integrations")
      .select("access_token")
      .eq("twitch_channel_id", request.broadcasterID)
      .single();

    if (error) {
      console.log(error);
      throw error;
    }

    request.headers["Authorization"] = `Bearer ${data.access_token}`;

    return request;
  },
  (error: any) => {
    return Promise.reject(error);
  }
);

//spotify response interceptor
SpotifyAPI.interceptors.response.use(
  (response) => {
    return response;
  },
  //handle response error
  async function (response_error) {
    //originalRequest
    const originalRequest = response_error.config;

    //if the error status = 401 we update the token and retry
    if (response_error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      //get the channel from the request
      const channel_id = response_error.response?.config.broadcasterID;

      const { data, error } = await supabase.from("spotify_integrations").select("refresh_token").eq("twitch_channel_id", channel_id).single();

      if (!data || error) {
        console.log("Error refreshing token");
        return;
      }

      const { access_token } = await spotifyAPI.refresh_token(data.refresh_token);


      //update the headers for the new request
      originalRequest.headers["Authorization"] = "Bearer " + access_token;

      //make the new request
      const res = SpotifyAPI(originalRequest);

      return res;
    }
    return Promise.reject(response_error);
  }
);

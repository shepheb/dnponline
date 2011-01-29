{-# LANGUAGE TemplateHaskell, OverloadedStrings, QuasiQuotes #-}
module Handler.Handlers where

import DnP
import Control.Monad
import Control.Applicative
import Control.Arrow

import qualified Data.Map as M
import Control.Concurrent.STM
import Control.Concurrent.STM.TVar
import Control.Concurrent.STM.TChan

import Data.Maybe (fromMaybe)


import Handler.Commands
import Handler.Util



getRootR :: Handler RepHtml
getRootR = do
    mu <- maybeAuth
    defaultLayout $ do
        h2id <- newIdent
        setTitle "Dice and Paper Online"
        addWidget $(widgetFile "homepage")


getCheckInR :: Handler RepJson
getCheckInR = do
  (uid,u) <- requireAuth
  liftIO $ putStrLn $ "checkIn from " ++ show uid
  table <- getTable uid
  chan <- maybe (invalidArgs ["Invalid User ID"]) (return.channel) $ M.lookup uid (clients table)
  -- blocks until we have something to send
  msg <- liftIO . atomically $ readTChan chan
  case msg of
    MessageChat s c -> do
      liftIO $ putStrLn $ "Responding to " ++ show uid ++ " with " ++ show (s,c)
      jsonToRepJson $ zipJson ["type", "sender", "content"] ["chat",s,c]
    MessageBoard ts -> do
      liftIO $ putStrLn $ "Sending Tokens to " ++ show uid
      jsonToRepJson $ jsonMap [("type", jsonScalar "board"), 
                               ("tokens", jsonList $ map (\t -> zipJson ["x","y","image","name"] 
                                                                        $ map ($ t) [show.tokenX, show.tokenY, file, tokenName]) 
                                                         ts
                                )]


getSayR :: Handler RepJson
getSayR = do
  (uid,u) <- requireAuth
  mnick <- lookupSession "nick"
  mmsg  <- lookupGetParam "message"
  let nick = fromMaybe ("user" ++ showPersistKey uid) mnick
      msg  = fromMaybe "" mmsg -- blank messages won't get sent
  liftIO $ putStrLn $ nick ++ " (" ++ show uid ++ ") said: " ++ msg
  res <- case msg of
           "" -> return $ ResponseSuccess
           _  -> runCommand uid u nick msg

  case res of
    ResponseSuccess -> jsonToRepJson $ zipJson ["status"] ["success"]
    ResponsePrivate s -> jsonToRepJson $ zipJson ["status","message"] ["private",s]


-- handles the main logic on an incoming chat message. does the actual feeding of clients with data
runCommand :: UserId -> User -> String -> String -> Handler CommandResponse
runCommand _ _ _ []    = return ResponseSuccess -- do nothing on empty messages
runCommand _ _ _ ['/'] = return ResponseSuccess -- do nothing on just a slash
runCommand uid u nick ('/':msg) = do
  let (cmd:args) = words msg -- guaranteed to be at least one by the ['/'] case above
  let mf = M.lookup cmd commandMap
  case mf of
    Nothing -> return $ ResponsePrivate $ "Unknown command: '" ++ cmd ++ "'"
    Just f  -> f uid u nick cmd args

runCommand uid u nick msg = send uid nick msg




getChatR :: Handler RepHtml
getChatR = defaultLayout $ do
  setTitle "Dice and Paper Online - Chat"
  addScriptRemote "http://ajax.googleapis.com/ajax/libs/jquery/1.4.2/jquery.min.js"
  $(widgetFile "chat")




gridCols = 30
gridRows = 15

gridWidget :: Widget ()
gridWidget = [$hamlet|
  %table.grid
    $forall tableContent row
      ^row^
  |]
  where tableContent = map tableRows [0..gridRows-1]
        tableRows r  = let row = map (tableSquare r) [0..gridCols-1] in [$hamlet|
          %tr.grid
            $forall row square
              ^square^
          |]
        tableSquare r c = let squareId = "sq_" ++ show c ++ "x" ++ show r in [$hamlet| %td.grid#$squareId$ |]

